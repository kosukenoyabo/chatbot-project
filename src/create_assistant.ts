import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config(); // .env ファイルから API キーなどを読み込む

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.error("エラー: OPENAI_API_KEY が .env ファイルに設定されていません。");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

async function createAssistant() {
  console.log("Creating Assistant...");
  try {
    const assistant = await openai.beta.assistants.create({
      name: "PDF Analyzer Assistant", // アシスタントの名前
      instructions: "あなたは、ユーザーから提供されたPDFドキュメントの内容を分析し、質問に答えるアシスタントです。", // アシスタントへの指示
      model: "gpt-4o", // 使用するモデル
      tools: [{ type: "file_search" }], // File Search ツールを有効化
    });

    console.log("Assistant created successfully!");
    console.log("--------------------------------------------------");
    console.log(`Assistant ID: ${assistant.id}`);
    console.log("--------------------------------------------------");
    console.log("この Assistant ID を .env ファイルに OPENAI_ASSISTANT_ID として設定してください。");

  } catch (error) {
    console.error("Assistant の作成中にエラーが発生しました:", error);
  }
}

createAssistant(); 