"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNewChatThread = startNewChatThread;
exports.isValidThread = isValidThread;
exports.uploadPdfToOpenAI = uploadPdfToOpenAI;
exports.addMessageAndGetResponse = addMessageAndGetResponse;
exports.getThreadHistory = getThreadHistory;
const openai_1 = __importDefault(require("openai")); // OpenAI SDKをインポート
const dotenv_1 = __importDefault(require("dotenv")); // dotenvをインポート
const fs_1 = __importDefault(require("fs")); // ファイルシステムモジュールを追加
// import { Readable } from 'stream'; // Readable は不要になる
dotenv_1.default.config(); // 環境変数をロード
// --- OpenAIクライアントの初期化 ---
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
    console.error("重大なエラー: OPENAI_API_KEY が .env ファイルに設定されていません。アプリケーションを終了します。");
    process.exit(1); // APIキーがない場合は起動せずに終了
}
const openai = new openai_1.default({
    apiKey: openaiApiKey,
});
// OpenAI SDKが提供する型を使用するため、自前のインターフェース定義は削除
// interface ChatCompletionMessageParam {
//   role: "system" | "user" | "assistant";
//   content: string | OpenAI.Chat.Completions.ChatCompletionContentPart[];
// }
// セッション管理を Thread ID ベースに変更
const activeThreads = new Set(); // アクティブな Thread ID を管理
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
function startNewChatThread() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const thread = yield openai.beta.threads.create();
            console.log(`[Chat Service] New thread created: ${thread.id}`);
            activeThreads.add(thread.id); // スレッドIDを管理リストに追加
            return thread.id;
        }
        catch (error) {
            console.error('[Chat Service] Error creating new thread:', error);
            throw new Error('新しいチャットスレッドの作成に失敗しました。');
        }
    });
}
/**
 * 指定されたスレッドIDが有効か（アクティブか）どうかを確認する
 * @param {string} threadId 確認するスレッドID
 * @returns {boolean} スレッドIDが有効な場合はtrue、そうでない場合はfalse
 */
function isValidThread(threadId) {
    return activeThreads.has(threadId);
}
/**
 * 指定されたパスのPDFファイルをOpenAI Files APIにアップロードし、File IDを返す
 * @param filePath アップロードするファイルの一時パス
 * @param originalFilename 元のファイル名（オプション、ログ表示用）
 * @returns {Promise<string>} OpenAI File ID
 */
function uploadPdfToOpenAI(filePath, originalFilename) {
    return __awaiter(this, void 0, void 0, function* () {
        const filenameForLog = originalFilename || filePath;
        console.log(`[Chat Service] Uploading file "${filenameForLog}" from path "${filePath}" for Assistant API...`);
        try {
            const fileStream = fs_1.default.createReadStream(filePath);
            const fileObject = yield openai.files.create({
                file: fileStream,
                purpose: 'assistants',
            });
            console.log(`[Chat Service] File uploaded successfully for Assistant. File ID: ${fileObject.id}`);
            return fileObject.id;
        }
        catch (error) {
            console.error(`[Chat Service] Error uploading file "${filenameForLog}" to OpenAI:`, error);
            const serviceError = new Error(error.message || 'OpenAIへのファイルアップロード中にエラーが発生しました。');
            serviceError.status = error.status || 500;
            throw serviceError;
        }
        finally {
            // --- 重要: 一時ファイルを削除 ---
            fs_1.default.unlink(filePath, (err) => {
                if (err) {
                    console.error(`[Chat Service] Error deleting temporary file "${filePath}":`, err);
                }
                else {
                    console.log(`[Chat Service] Temporary file deleted: ${filePath}`);
                }
            });
        }
    });
}
/**
 * ユーザーメッセージ（およびオプションでFile ID）をスレッドに追加し、AIからの応答を取得する
 * @param threadId スレッドID
 * @param userMessage ユーザーからのメッセージテキスト
 * @param fileId (オプション) OpenAI Files APIでアップロードされたPDFのFile ID
 * @returns {Promise<string>} AIからの応答テキスト
 */
function addMessageAndGetResponse(threadId, userMessage, fileId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!isValidThread(threadId)) {
            const error = new Error('無効なスレッドIDです。');
            error.status = 404;
            throw error;
        }
        if (!ASSISTANT_ID) { // 再度チェック
            throw new Error('Assistant IDが設定されていません。');
        }
        console.log(`[Chat Service] Adding message to thread ${threadId}${fileId ? ' with File ID ' + fileId : ''}: "${userMessage}"`);
        try {
            // 1. メッセージをスレッドに追加 (ファイルがあれば添付)
            const messageCreateParams = {
                role: 'user',
                content: userMessage,
            };
            if (fileId) {
                messageCreateParams.attachments = [{ file_id: fileId, tools: [{ type: 'file_search' }] }];
            }
            yield openai.beta.threads.messages.create(threadId, messageCreateParams);
            console.log(`[Chat Service] Message added to thread ${threadId}.`);
            // 2. Run を作成し、完了を待つ (createAndPoll ヘルパーを使用)
            console.log(`[Chat Service] Creating and polling run for thread ${threadId}...`);
            const run = yield openai.beta.threads.runs.createAndPoll(threadId, {
                assistant_id: ASSISTANT_ID,
                // ここで追加の指示を与えることも可能
                // instructions: "Please address the user as Jane Doe.",
            });
            console.log(`[Chat Service] Run completed with status: ${run.status}`);
            if (run.status === 'completed') {
                // 3. 完了した Run に対応するメッセージリストを取得
                const messages = yield openai.beta.threads.messages.list(threadId, {
                    run_id: run.id, // 特定の Run で追加されたメッセージを取得
                    order: 'desc', // 新しい順で取得
                    limit: 1 // 最新のメッセージ（アシスタントの応答）のみ取得
                });
                const assistantMessage = messages.data[0];
                if (assistantMessage && ((_a = assistantMessage.content[0]) === null || _a === void 0 ? void 0 : _a.type) === 'text') {
                    const assistantResponse = assistantMessage.content[0].text.value;
                    console.log(`[Chat Service] Received response from Assistant for thread ${threadId}.`);
                    // (オプション) 応答に含まれるファイル引用などを処理する場合はここで行う (ドキュメント参照)
                    // const annotations = assistantMessage.content[0].text.annotations;
                    // ...
                    return assistantResponse;
                }
                else {
                    console.error('[Chat Service] Assistant response format is unexpected.', assistantMessage);
                    throw new Error('AIからの応答形式が正しくありません。');
                }
            }
            else {
                console.error(`[Chat Service] Run failed or was cancelled. Status: ${run.status}`, run.last_error);
                throw new Error(`AIの処理に失敗しました。ステータス: ${run.status}`);
            }
        }
        catch (error) {
            console.error(`[Chat Service] Error processing message or run for thread ${threadId}:`, error);
            const errorMessage = ((_b = error.error) === null || _b === void 0 ? void 0 : _b.message) || error.message || 'AIとの通信中に予期せぬエラーが発生しました。';
            const statusCode = error.status || 500;
            const serviceError = new Error(errorMessage);
            serviceError.status = statusCode;
            throw serviceError;
        }
    });
}
/**
 * 指定されたスレッドのメッセージ履歴を取得する
 * @param {string} threadId スレッドID
 * @returns {Promise<OpenAI.Beta.Threads.Messages.Message[]>} メッセージ履歴 (新しい順)
 */
function getThreadHistory(threadId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!isValidThread(threadId)) {
            throw new Error('無効なスレッドIDです。');
        }
        try {
            const messages = yield openai.beta.threads.messages.list(threadId, { order: 'asc' }); // 古い順で取得
            return messages.data;
        }
        catch (error) {
            console.error(`[Chat Service] Error fetching history for thread ${threadId}:`, error);
            throw new Error('メッセージ履歴の取得に失敗しました。');
        }
    });
}
//# sourceMappingURL=chatService.js.map