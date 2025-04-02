// src/routes/upload.ts
import express, { Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path'; // path モジュールをインポート
import os from 'os'; // os モジュールをインポート
import { uploadPdfToOpenAI } from '../services/chatService'; // chatServiceから新しい関数をインポート

const router: Router = express.Router();

// Multer の設定: 元の拡張子を保持するように変更
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 'uploads/' ディレクトリが存在することを確認 (なければ作成)
        const uploadDir = 'uploads/';
        // fs.mkdirSync(uploadDir, { recursive: true }); // 同期的に作成する場合
        // 非同期で作成する場合は、事前にディレクトリを作成しておくか、
        // ここで非同期処理を行う必要がある (例: fs.mkdir)
        // 簡単のため、事前に 'uploads' ディレクトリが存在する前提とします
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 一意なファイル名 + 元の拡張子
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // file.fieldname は 'file'、uniqueSuffix は一意な文字列、path.extname で元の拡張子を取得
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Multer ミドルウェアの設定を更新
const upload = multer({
    storage: storage, // 上で定義した storage を使用
    limits: { fileSize: 50 * 1024 * 1024 } // 例: 50MB のファイルサイズ制限 (任意)
});

// エンドポイント名を /upload-pdf に変更 (任意)
router.post('/upload-pdf', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    console.log('リクエスト受信: POST /api/upload-pdf');

    if (!req.file) {
        console.log('[Upload Route] No file uploaded.');
        res.status(400).json({ message: 'ファイルがアップロードされていません。' });
        return; // 関数の実行をここで終了させる場合は return; のみ記述
    }

    // multer がファイルをディスクに保存した場合、req.file に path プロパティが含まれる
    // req.file が undefined でないことを TypeScript に伝えるために `!` を追加
    const tempFilePath = req.file!.path; // ここには拡張子付きのパスが入る
    const originalFilename = req.file!.originalname; // 元のファイル名も取得

    // ログ出力で一時ファイルパスを確認
    console.log(`[Upload Route] Received file: ${originalFilename}, saved temporarily to: ${tempFilePath}, size: ${req.file!.size} bytes, mimetype: ${req.file!.mimetype}`);

    try {
        // chatService の関数にファイルパスと元のファイル名を渡す
        // uploadPdfToOpenAI には拡張子付きのファイルパスを渡す
        const fileId = await uploadPdfToOpenAI(tempFilePath, originalFilename);

        console.log(`[Upload Route] File processed by chatService. OpenAI File ID: ${fileId}`);

        // 成功応答を返す
        res.status(200).json({
            message: 'ファイルが正常にアップロードされ、OpenAIに登録されました。',
            fileId: fileId,
            filename: originalFilename // 元のファイル名も返す
        });

    } catch (error: any) {
        console.error('[Upload Route] Error processing file upload:', error);
        // エラー応答を返す
        const statusCode = error.status || 500;
        res.status(statusCode).json({ message: 'ファイルのアップロード処理中にエラーが発生しました。', error: error.message });
    }
    // finally ブロックでの一時ファイル削除は uploadPdfToOpenAI 内で行われる
});

// 古い /upload エンドポイントは削除またはコメントアウト
/*
router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    // ... (古いコード) ...
});
*/

export default router;
  
// curl -X POST -F "file=@/Users/kosuke/Downloads/EconCSII.pdf" http://localhost:3000/api/upload-pdf
// SESSION_ID="961d9418-6416-4c8f-ad9b-92576cc445a4" 
// FILE_ID="file-K3WGJqMUhm2BcbKGW3VuJH"       

// curl -X POST http://localhost:3000/api/chat \
//   -H "Content-Type: application/json" \
//   -d '{
//     "sessionId": "'"$SESSION_ID"'",
//     "message": "このPDFの概要を教えてください。",
//     "fileId": "'"$FILE_ID"'"
//   }'

// curl -X POST http://localhost:3000/api/chat \
//           -H "Content-Type: application/json" \
//           -d '{
//             "threadId": "'"thread_LuAkRYwL4nd7tI24OPhavL9Y"'",
//             "message": "このPDFファイルの概要を教えてください。",
//             "fileId": "'"file-EtP5wpKNjDwGXw5aJMH1iE"'"
//           }'aaaaaaaa
