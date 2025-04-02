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
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // .env ファイルから API キーなどを読み込む
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
    console.error("エラー: OPENAI_API_KEY が .env ファイルに設定されていません。");
    process.exit(1);
}
const openai = new openai_1.default({
    apiKey: openaiApiKey,
});
function createAssistant() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Creating Assistant...");
        try {
            const assistant = yield openai.beta.assistants.create({
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
        }
        catch (error) {
            console.error("Assistant の作成中にエラーが発生しました:", error);
        }
    });
}
createAssistant();
//# sourceMappingURL=create_assistant.js.map