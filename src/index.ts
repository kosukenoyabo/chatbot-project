// src/index.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs'; // fsモジュールが必要な場合は残す (uploadsディレクトリ作成など)
import chatRoutes from './routes/chat';
import uploadRoutes from './routes/upload';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// --- uploads ディレクトリの確認・作成 (必要であれば残す) ---
// const uploadsDirectory = path.resolve(__dirname, '../uploads');
// ... (ディレクトリ作成処理) ...


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
