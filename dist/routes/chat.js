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
// src/routes/chat.ts
const express_1 = __importDefault(require("express"));
const chatService_1 = require("../services/chatService"); // chatServiceから関数をインポート
const router = express_1.default.Router();
// --- エンドポイント定義 ---
/**
 * @route POST /api/start-chat
 * @description 新しいチャットセッションを開始する
 * @access Public
 */
router.post('/start-chat', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('リクエスト受信: POST /api/start-chat');
    try {
        const threadId = yield (0, chatService_1.startNewChatThread)();
        res.status(201).json({ message: '新しいチャットスレッドが開始されました。', threadId: threadId });
    }
    catch (error) {
        console.error('[Start Chat Route] Error starting new chat thread:', error);
        res.status(500).json({ message: 'チャットスレッドの開始中にエラーが発生しました。', error: error.message });
    }
}));
/**
 * @route POST /api/chat
 * @description チャットメッセージを送信し、AIからの応答を取得する
 * @access Public
 */
router.post('/chat', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('リクエスト受信: POST /api/chat');
    // req.body から sessionId の代わりに threadId を取得
    const { threadId, message, fileId } = req.body;
    // threadId と message が存在するかチェック
    if (!threadId || typeof threadId !== 'string' || !message || typeof message !== 'string') {
        console.log('[Chat Route] Invalid request body:', req.body);
        res.status(400).json({ error: '無効なリクエストです: threadIdとmessageが必要です。' });
        return;
    }
    // (オプション) isValidThread でチェックすることも可能ですが、
    // addMessageAndGetResponse 内でもチェックされるため必須ではない
    // if (!isValidThread(threadId)) {
    //     res.status(404).json({ error: '無効なスレッドIDです。' });
    //     return;
    // }
    try {
        console.log(`[Chat Route] Calling addMessageAndGetResponse for thread ${threadId}`);
        // addMessageAndGetResponse に threadId, message, fileId を渡す
        const responseMessage = yield (0, chatService_1.addMessageAndGetResponse)(threadId, message, fileId);
        res.json({ response: responseMessage });
    }
    catch (error) {
        console.error(`[Chat Route] Error processing message for thread ${threadId}:`, error);
        // chatService から渡されたステータスコードを使うか、デフォルトで500を設定
        const statusCode = error.status || 500;
        res.status(statusCode).json({ error: error.message || 'メッセージの処理中にエラーが発生しました。' });
    }
}));
/**
 * @route GET /api/history/:sessionId
 * @description 指定されたセッションのチャット履歴を取得する
 * @access Public
 */
router.get('/history/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    if (!(0, chatService_1.isValidThread)(sessionId)) {
        res.status(404).json({ error: '指定されたセッションIDが見つかりません。' });
        return;
    }
    const history = (0, chatService_1.getThreadHistory)(sessionId);
    res.status(200).json({ history });
});
exports.default = router;
//# sourceMappingURL=chat.js.map