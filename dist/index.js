"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path")); // path モジュールをインポート
const chat_1 = __importDefault(require("./routes/chat"));
const upload_1 = __importDefault(require("./routes/upload"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// --- ミドルウェア設定 ---
// 静的ファイルを提供 (public ディレクトリ)
// dist/index.js から見て '../public' が正しい相対パス
const publicDirectoryPath = path_1.default.resolve(__dirname, '../public'); // パスを修正
console.log(`Serving static files from: ${publicDirectoryPath}`); // パスを確認するためのログ
app.use(express_1.default.static(publicDirectoryPath));
// JSONリクエストボディをパース
app.use(express_1.default.json());
// デバッグ用のログ
app.use((req, res, next) => {
    // APIリクエストのみログ出力するように変更（静的ファイルリクエストは除外）
    if (req.path.startsWith('/api')) {
        console.log(`APIリクエスト受信: ${req.method} ${req.path}`);
    }
    next();
});
// --- API ルート ---
app.use('/api', chat_1.default);
app.use('/api', upload_1.default);
// --- ルートパスへのアクセス ---
// express.static で public/index.html が提供されるため、
// このルートは通常不要になるか、APIドキュメントなどにリダイレクトしても良い
// app.get('/', (req, res) => {
//   res.send('チャットボットサーバーが起動中です！');
// });
// --- エラーハンドリング ---
// 404ハンドリング (APIルートにマッチしなかった場合)
// 静的ファイルが見つからない場合もここに来る可能性がある
app.use('/api', (req, res) => {
    console.log(`未定義APIルートへのアクセス (404): ${req.method} ${req.path}`);
    res.status(404).json({ error: 'API Not Found' });
});
// グローバルエラーハンドラ (API処理中のエラー)
app.use('/api', (err, req, res, next) => {
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
//# sourceMappingURL=index.js.map