// src/index.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs'; // fsモジュールをインポート
import chatRoutes from './routes/chat';
import uploadRoutes from './routes/upload';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// --- uploads ディレクトリの確認・作成 ---
// process.cwd() を基準に uploads ディレクトリへのパスを生成
const projectRoot = process.cwd();
const uploadsDirectory = path.join(projectRoot, 'uploads');
console.log(`Checking for uploads directory at: ${uploadsDirectory}`); // パス確認ログ
if (!fs.existsSync(uploadsDirectory)) {
  try {
    fs.mkdirSync(uploadsDirectory, { recursive: true });
    console.log(`Created uploads directory: ${uploadsDirectory}`);
  } catch (err) {
    console.error(`Error creating uploads directory: ${uploadsDirectory}`, err);
    process.exit(1); // ディレクトリ作成に失敗したら起動を中止
  }
} else {
  console.log(`Uploads directory already exists: ${uploadsDirectory}`);
}


// --- ミドルウェア設定 ---

// 静的ファイルを提供 (public ディレクトリ)
// process.cwd() (プロジェクトルート) を基準にする方法に変更
const projectRoot = process.cwd(); // Render環境では /opt/render/project/src/ になるはず
const publicDirectoryPath = path.join(projectRoot, 'public'); // プロジェクトルート直下の public を指定
console.log(`Serving static files from (using cwd): ${publicDirectoryPath}`); // ログメッセージ変更
app.use(express.static(publicDirectoryPath)); // 修正後のパスを使用

// JSONリクエストボディをパース
app.use(express.json());

// デバッグ用のログ
app.use((req, res, next) => {
  // APIリクエストのみログ出力するように変更（静的ファイルリクエストは除外）
  if (req.path.startsWith('/api')) {
      console.log(`APIリクエスト受信: ${req.method} ${req.path}`);
  }
  next();
});

// --- API ルート ---
app.use('/api', chatRoutes);
app.use('/api', uploadRoutes);

// --- ルートパスへのアクセス ---
// express.static で public/index.html が提供されるため、
// このルートは通常不要になるか、APIドキュメントなどにリダイレクトしても良い
// app.get('/', (req, res) => {
//   res.send('チャットボットサーバーが起動中です！');
// });

// --- エラーハンドリング ---

// 404ハンドリング (APIルートにマッチしなかった場合)
// 静的ファイルが見つからない場合もここに来る可能性がある
app.use('/api', (req: Request, res: Response) => {
  console.log(`未定義APIルートへのアクセス (404): ${req.method} ${req.path}`);
  res.status(404).json({ error: 'API Not Found' });
});

// グローバルエラーハンドラ (API処理中のエラー)
app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("API グローバルエラーハンドラ:", err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  // APIリクエストに対してJSONでエラーを返す
  res.status(status).json({ error: message });
});

// --- サーバー起動 ---
app.listen(port, () => {
  console.log(`サーバーがポート ${port} で起動しました。`);
  console.log(`フロントエンドアクセス: http://localhost:${port}`);
});
