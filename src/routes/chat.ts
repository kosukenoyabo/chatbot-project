// src/routes/chat.ts
import express, { Request, Response, Router } from 'express';
import { startNewChatThread, addMessageAndGetResponse, isValidThread, getThreadHistory } from '../services/chatService'; // chatServiceから関数をインポート

const router: Router = express.Router();

// --- エンドポイント定義 ---

/**
 * @route POST /api/start-chat
 * @description 新しいチャットセッションを開始する
 * @access Public
 */
router.post('/start-chat', async (req: Request, res: Response) => {
  console.log('リクエスト受信: POST /api/start-chat');
  try {
    const threadId = await startNewChatThread();
    res.status(201).json({ message: '新しいチャットスレッドが開始されました。', threadId: threadId });
  } catch (error: any) {
    console.error('[Start Chat Route] Error starting new chat thread:', error);
    res.status(500).json({ message: 'チャットスレッドの開始中にエラーが発生しました。', error: error.message });
  }
});

/**
 * @route POST /api/chat
 * @description チャットメッセージを送信し、AIからの応答を取得する
 * @access Public
 */
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
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
        const responseMessage = await addMessageAndGetResponse(threadId, message, fileId);
        res.json({ response: responseMessage });
    } catch (error: any) {
        console.error(`[Chat Route] Error processing message for thread ${threadId}:`, error);
        // chatService から渡されたステータスコードを使うか、デフォルトで500を設定
        const statusCode = error.status || 500;
        res.status(statusCode).json({ error: error.message || 'メッセージの処理中にエラーが発生しました。' });
    }
});

/**
 * @route GET /api/history/:sessionId
 * @description 指定されたセッションのチャット履歴を取得する
 * @access Public
 */
router.get('/history/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    if (!isValidThread(sessionId)) {
        res.status(404).json({ error: '指定されたセッションIDが見つかりません。' });
        return;
    }
    const history = getThreadHistory(sessionId);
    res.status(200).json({ history });
});

export default router;
