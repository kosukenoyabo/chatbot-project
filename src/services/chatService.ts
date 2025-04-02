import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai'; // OpenAI SDKをインポート
import dotenv from 'dotenv'; // dotenvをインポート
import fs from 'fs'; // ファイルシステムモジュールを追加
import path from 'path'; // path モジュールをインポート
// import { Readable } from 'stream'; // Readable は不要になる

dotenv.config(); // 環境変数をロード

// --- OpenAIクライアントの初期化 ---
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.error("重大なエラー: OPENAI_API_KEY が .env ファイルに設定されていません。アプリケーションを終了します。");
  process.exit(1); // APIキーがない場合は起動せずに終了
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// OpenAI SDKが提供する型を使用するため、自前のインターフェース定義は削除
// interface ChatCompletionMessageParam {
//   role: "system" | "user" | "assistant";
//   content: string | OpenAI.Chat.Completions.ChatCompletionContentPart[];
// }

// セッション管理を Thread ID ベースに変更
const activeThreads: Set<string> = new Set(); // アクティブな Thread ID を管理

// Assistant ID (事前に作成し、環境変数などから読み込む)
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;
if (!ASSISTANT_ID) {
    console.error("重大なエラー: OPENAI_ASSISTANT_ID が設定されていません。");
    process.exit(1);
}

// --- 公開関数 ---

/**
 * 新しいチャットスレッドを開始し、スレッドIDを返す
 * @returns {Promise<string>} 新しく生成されたスレッドID
 */
export async function startNewChatThread(): Promise<string> {
  try {
    const thread = await openai.beta.threads.create();
    console.log(`[Chat Service] New thread created: ${thread.id}`);
    activeThreads.add(thread.id); // スレッドIDを管理リストに追加
    return thread.id;
  } catch (error: any) {
    console.error('[Chat Service] Error creating new thread:', error);
    throw new Error('新しいチャットスレッドの作成に失敗しました。');
  }
}

/**
 * 指定されたスレッドIDが有効か（アクティブか）どうかを確認する
 * @param {string} threadId 確認するスレッドID
 * @returns {boolean} スレッドIDが有効な場合はtrue、そうでない場合はfalse
 */
export function isValidThread(threadId: string): boolean {
  return activeThreads.has(threadId);
}

/**
 * 指定されたパスのPDFファイルをOpenAI Files APIにアップロードし、File IDを返す
 * @param filePath アップロードするファイルの一時パス
 * @param originalFilename 元のファイル名（オプション、ログ表示用）
 * @returns {Promise<string>} OpenAI File ID
 */
export async function uploadPdfToOpenAI(filePath: string, originalFilename?: string): Promise<string> {
    const filenameForLog = originalFilename || filePath;
    console.log(`[Chat Service] Uploading file "${filenameForLog}" from path "${filePath}" for Assistant API...`);
    try {
        const fileStream = fs.createReadStream(filePath);
        const fileObject = await openai.files.create({
            file: fileStream,
            purpose: 'assistants',
        });
        console.log(`[Chat Service] File uploaded successfully for Assistant. File ID: ${fileObject.id}`);
        return fileObject.id;
    } catch (error: any) {
        console.error(`[Chat Service] Error uploading file "${filenameForLog}" to OpenAI:`, error);
        const serviceError = new Error(error.message || 'OpenAIへのファイルアップロード中にエラーが発生しました。') as any;
        serviceError.status = error.status || 500;
        throw serviceError;
    } finally {
        // --- 重要: 一時ファイルを削除 ---
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(`[Chat Service] Error deleting temporary file "${filePath}":`, err);
            } else {
                console.log(`[Chat Service] Temporary file deleted: ${filePath}`);
            }
        });
    }
}

/**
 * ユーザーメッセージ（およびオプションでFile ID）をスレッドに追加し、AIからの応答を取得する
 * @param threadId スレッドID
 * @param userMessage ユーザーからのメッセージテキスト
 * @param fileId (オプション) OpenAI Files APIでアップロードされたPDFのFile ID
 * @returns {Promise<string>} AIからの応答テキスト
 */
export async function addMessageAndGetResponse(threadId: string, userMessage: string, fileId?: string): Promise<string> {
  if (!isValidThread(threadId)) {
    const error = new Error('無効なスレッドIDです。') as any;
    error.status = 404;
    throw error;
  }
  if (!ASSISTANT_ID) { // 再度チェック
      throw new Error('Assistant IDが設定されていません。');
  }

  console.log(`[Chat Service] Adding message to thread ${threadId}${fileId ? ' with File ID ' + fileId : ''}: "${userMessage}"`);

  try {
    // 1. メッセージをスレッドに追加 (ファイルがあれば添付)
    const messageCreateParams: OpenAI.Beta.Threads.Messages.MessageCreateParams = {
      role: 'user',
      content: userMessage,
    };
    if (fileId) {
      messageCreateParams.attachments = [{ file_id: fileId, tools: [{ type: 'file_search' }] }];
    }
    await openai.beta.threads.messages.create(threadId, messageCreateParams);
    console.log(`[Chat Service] Message added to thread ${threadId}.`);

    // 2. Run を作成し、完了を待つ (createAndPoll ヘルパーを使用)
    console.log(`[Chat Service] Creating and polling run for thread ${threadId}...`);
    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: ASSISTANT_ID,
      // ここで追加の指示を与えることも可能
      // instructions: "Please address the user as Jane Doe.",
    });

    console.log(`[Chat Service] Run completed with status: ${run.status}`);

    if (run.status === 'completed') {
      // 3. 完了した Run に対応するメッセージリストを取得
      const messages = await openai.beta.threads.messages.list(threadId, {
        run_id: run.id, // 特定の Run で追加されたメッセージを取得
        order: 'desc', // 新しい順で取得
        limit: 1 // 最新のメッセージ（アシスタントの応答）のみ取得
      });

      const assistantMessage = messages.data[0];

      if (assistantMessage && assistantMessage.content[0]?.type === 'text') {
        const assistantResponse = assistantMessage.content[0].text.value;
        console.log(`[Chat Service] Received response from Assistant for thread ${threadId}.`);

        // (オプション) 応答に含まれるファイル引用などを処理する場合はここで行う (ドキュメント参照)
        // const annotations = assistantMessage.content[0].text.annotations;
        // ...

        return assistantResponse;
      } else {
        console.error('[Chat Service] Assistant response format is unexpected.', assistantMessage);
        throw new Error('AIからの応答形式が正しくありません。');
      }
    } else {
      console.error(`[Chat Service] Run failed or was cancelled. Status: ${run.status}`, run.last_error);
      throw new Error(`AIの処理に失敗しました。ステータス: ${run.status}`);
    }

  } catch (error: any) {
    console.error(`[Chat Service] Error processing message or run for thread ${threadId}:`, error);
    const errorMessage = error.error?.message || error.message || 'AIとの通信中に予期せぬエラーが発生しました。';
    const statusCode = error.status || 500;
    const serviceError = new Error(errorMessage) as any;
    serviceError.status = statusCode;
    throw serviceError;
  }
}

/**
 * 指定されたスレッドのメッセージ履歴を取得する
 * @param {string} threadId スレッドID
 * @returns {Promise<OpenAI.Beta.Threads.Messages.Message[]>} メッセージ履歴 (新しい順)
 */
export async function getThreadHistory(threadId: string): Promise<OpenAI.Beta.Threads.Messages.Message[]> {
    if (!isValidThread(threadId)) {
        throw new Error('無効なスレッドIDです。');
    }
    try {
        const messages = await openai.beta.threads.messages.list(threadId, { order: 'asc' }); // 古い順で取得
        return messages.data;
    } catch (error: any) {
        console.error(`[Chat Service] Error fetching history for thread ${threadId}:`, error);
        throw new Error('メッセージ履歴の取得に失敗しました。');
    }
}

export const sendMessageToAssistant = async (threadId: string, message: string, fileId?: string): Promise<OpenAI.Beta.Threads.Messages.ThreadMessage[]> => {
  try {
    let fileUploadId: string | undefined = undefined;

    if (fileId) {
      // process.cwd() (プロジェクトルート) を基準に uploads ディレクトリ内のファイルパスを生成
      const filePath = path.join(process.cwd(), 'uploads', fileId); // 修正
      console.log(`Attempting to read file for OpenAI upload from: ${filePath}`); // デバッグログ

      // ファイルが存在するか確認
      if (!fs.existsSync(filePath)) {
          console.error(`File not found at path: ${filePath}. User provided fileId: ${fileId}`);
          // ユーザーに分かりやすいエラーを返す
          throw new Error(`アップロードされたファイルが見つかりません (${fileId})。サーバーが再起動したか、ファイルが削除された可能性があります。再度アップロードしてください。`);
      }

      console.log(`File found. Creating stream for OpenAI upload...`);
      const fileStream = fs.createReadStream(filePath);

      try {
        const openaiFile = await openai.files.create({
          file: fileStream,
          purpose: 'assistants',
        });
        fileUploadId = openaiFile.id;
        console.log(`File successfully uploaded to OpenAI, ID: ${fileUploadId}`);
      } catch (uploadError) {
        console.error(`Error uploading file stream to OpenAI from path: ${filePath}`, uploadError);
        throw new Error('OpenAIへのファイルアップロード中にエラーが発生しました。');
      }
    }

    // メッセージ送信オブジェクトの準備
    const messageData: OpenAI.Beta.Threads.Messages.MessageCreateParams = {
      role: 'user',
      content: message,
    };
    // OpenAIにアップロードしたファイルIDがあれば追加
    if (fileUploadId) {
      messageData.attachments = [{ file_id: fileUploadId, tools: [{ type: 'file_search' }] }];
      // messageData.file_ids = [fileUploadId]; // 古い形式 (Assistants v1)
    }

    console.log(`Sending message to thread ${threadId} with attachments: ${fileUploadId ? fileUploadId : 'none'}`);

    // OpenAIにメッセージを送信
    await openai.beta.threads.messages.create(threadId, messageData);

    console.log(`Creating run for thread ${threadId}`);
    // アシスタントに実行を指示
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
      // ここで指示を追加・変更できます
      // instructions: "追加の指示があればここに記述",
    });

    console.log(`Run created: ${run.id}. Waiting for completion...`);
    // 実行完了を待つ
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      console.log(`Run status: ${runStatus.status}`);
    }

    if (runStatus.status !== 'completed') {
      console.error(`Run failed with status: ${runStatus.status}`, runStatus.last_error);
      throw new Error(`アシスタントの実行に失敗しました。ステータス: ${runStatus.status}`);
    }

    console.log(`Run completed. Retrieving messages...`);
    // 完了したらメッセージリストを取得
    const messages = await openai.beta.threads.messages.list(threadId, {
        order: 'asc' // 古い順で取得（必要に応じて変更）
    });

    // 最新のアシスタントの応答を返す (list はページネーションされている可能性あり)
    // return messages.data.filter(msg => msg.run_id === run.id && msg.role === 'assistant');
    return messages.data; // とりあえず全メッセージを返す

  } catch (error) {
    console.error('Error in sendMessageToAssistant:', error);
    // エラーオブジェクトをそのまま投げるか、メッセージを整形して投げる
    throw error instanceof Error ? error : new Error('アシスタントへのメッセージ送信中に不明なエラーが発生しました。');
  }
};

