// DOM要素の取得と型付け
const chatbox = document.getElementById('chatbox') as HTMLDivElement | null;
const messageInput = document.getElementById('message-input') as HTMLInputElement | null;
const sendButton = document.getElementById('send-button') as HTMLButtonElement | null;
const uploadButton = document.getElementById('upload-button') as HTMLButtonElement | null;
const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
const selectedFileSpan = document.getElementById('selected-file') as HTMLSpanElement | null;
const clearFileButton = document.getElementById('clear-file-button') as HTMLButtonElement | null;
const loadingDiv = document.getElementById('loading') as HTMLDivElement | null;
const errorMessageDiv = document.getElementById('error-message') as HTMLDivElement | null;

// 状態変数
let threadId: string | null = null;
let currentFile: File | null = null;
let currentFileId: string | null = null; // アップロード後のFile IDを保持

// APIレスポンスの型定義 (簡易版)
interface StartChatResponse {
    threadId: string;
    message?: string; // サーバーからのメッセージがあれば
}

interface ChatResponse {
    response: string;
}

interface UploadResponse {
    fileId: string;
    message?: string;
    filename?: string;
}

interface ErrorResponse {
    error?: string;
    message?: string; // upload API は message を使う場合がある
}

// --- 初期化処理 ---
async function initializeChat(): Promise<void> {
    console.log('Initializing chat...');
    showLoading(true);
    if (errorMessageDiv) errorMessageDiv.textContent = '';

    // DOM要素の存在チェック
    if (!chatbox || !messageInput || !sendButton || !uploadButton || !fileInput || !selectedFileSpan || !clearFileButton || !loadingDiv || !errorMessageDiv) {
        console.error("必要なDOM要素が見つかりません。");
        handleError('ページの初期化に失敗しました。');
        showLoading(false);
        return;
    }

    try {
        const response = await fetch('/api/start-chat', { method: 'POST' });
        if (!response.ok) {
            const errorData: ErrorResponse = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `サーバーエラー: ${response.status}`);
        }
        const data: StartChatResponse = await response.json();
        threadId = data.threadId;
        console.log('Chat initialized. Thread ID:', threadId);
        addMessageToChatbox('assistant', 'こんにちは！どのようなご用件でしょうか？PDFファイルをアップロードして質問することもできます。');
    } catch (error: unknown) {
        console.error('Error initializing chat:', error);
        handleError(`チャットの開始に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        showLoading(false);
    }
}

// --- メッセージ送信処理 ---
async function sendMessage(): Promise<void> {
    if (!messageInput || !sendButton) return; // DOM要素チェック

    const message = messageInput.value.trim();
    if (!message && !currentFile) {
        return; // メッセージもファイルもない場合は何もしない
    }
    if (!threadId) {
        handleError('チャットセッションが初期化されていません。');
        return;
    }

    showLoading(true);
    sendButton.disabled = true;
    if (errorMessageDiv) errorMessageDiv.textContent = '';
    let userMessageContent = message;

    try {
        // 1. ファイルが選択されていればアップロード
        if (currentFile && !currentFileId) { // まだアップロードされていない場合のみ
            addMessageToChatbox('system', `「${currentFile.name}」をアップロード中...`);
            currentFileId = await uploadFile(currentFile);
            addMessageToChatbox('system', `「${currentFile.name}」のアップロード完了 (File ID: ${currentFileId})`);
            // ファイル名をメッセージに追加（任意）
            if (message) {
                userMessageContent = `ファイル「${currentFile.name}」について: ${message}`;
            } else {
                userMessageContent = `ファイル「${currentFile.name}」について質問があります。`;
            }
        }

        // 2. ユーザーメッセージをチャットに追加
        const displayMessage = userMessageContent || `ファイル「${currentFile?.name || 'アップロード済みファイル'}」について`;
        if (message || currentFileId) { // メッセージがあるか、ファイルがアップロードされた場合
             addMessageToChatbox('user', displayMessage);
        }

        // 3. チャットAPIにメッセージ送信
        const requestBody = {
            threadId: threadId,
            // メッセージが空でもファイルがあればファイルに関する質問とする
            message: message || `ファイル「${currentFile?.name || 'アップロード済みファイル'}」について質問があります。`,
            fileId: currentFileId // アップロード済みのFile IDを渡す (nullの場合もある)
        };

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData: ErrorResponse = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `サーバーエラー: ${response.status}`);
        }

        const data: ChatResponse = await response.json();

        // 4. アシスタントの応答をチャットに追加
        addMessageToChatbox('assistant', data.response);

        // 5. 入力とファイル選択をクリア
        messageInput.value = '';
        clearFileSelection(); // ファイルIDもクリア

    } catch (error: unknown) {
        console.error('Error sending message:', error);
        handleError(`メッセージの送信中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        showLoading(false);
        sendButton.disabled = false;
        messageInput.focus(); // 入力フィールドにフォーカスを戻す
    }
}

// --- ファイルアップロード処理 ---
async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/upload-pdf', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            // upload API は error ではなく message を返すことがあるため両方チェック
            const errorData: ErrorResponse = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `アップロードエラー: ${response.status}`);
        }
        const data: UploadResponse = await response.json();
        if (!data.fileId) {
            throw new Error('サーバーからFile IDが返されませんでした。');
        }
        return data.fileId; // File IDを返す
    } catch (error: unknown) {
        console.error('Error uploading file:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        handleError(`ファイルのアップロードに失敗しました: ${errorMessage}`);
        clearFileSelection(); // エラー時はファイル選択もクリア
        // エラーを再スローして sendMessage で処理できるようにする
        throw new Error(errorMessage);
    }
}

// --- UIヘルパー関数 ---
type MessageSender = 'system' | 'user' | 'assistant';

function addMessageToChatbox(sender: MessageSender, message: string): void {
    if (!chatbox) return;
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);
    // テキスト内の改行を <br> タグに変換して表示 (安全のため textContent を基本とし、改行のみ置換)
    // messageElement.textContent = message; // 基本はtextContentでXSS対策
    messageElement.innerHTML = message.replace(/&/g, '&amp;')
                                     .replace(/</g, '&lt;')
                                     .replace(/>/g, '&gt;')
                                     .replace(/"/g, '&quot;')
                                     .replace(/'/g, '&#039;')
                                     .replace(/\n/g, '<br>'); // 改行のみHTMLに
    chatbox.appendChild(messageElement);
    // 自動スクロール
    chatbox.scrollTop = chatbox.scrollHeight;
}

function showLoading(isLoading: boolean): void {
    if (loadingDiv) {
        loadingDiv.style.display = isLoading ? 'block' : 'none';
    }
}

function handleError(message: string): void {
    if (errorMessageDiv) {
        errorMessageDiv.textContent = message;
    }
}

function updateSelectedFileUI(): void {
    if (!selectedFileSpan || !clearFileButton) return;
    if (currentFile) {
        selectedFileSpan.textContent = currentFile.name;
        clearFileButton.style.display = 'inline-block';
    } else {
        selectedFileSpan.textContent = 'なし';
        clearFileButton.style.display = 'none';
    }
}

function clearFileSelection(): void {
    currentFile = null;
    currentFileId = null; // File IDもクリア
    if (fileInput) fileInput.value = ''; // input要素の値もクリア
    updateSelectedFileUI();
}


// --- イベントリスナー設定 ---
function setupEventListeners(): void {
    if (!sendButton || !messageInput || !uploadButton || !fileInput || !clearFileButton) {
        console.warn("一部のDOM要素が見つからないため、イベントリスナーを設定できません。");
        return;
    }

    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) { // Shift+Enterでの改行を許可
            event.preventDefault(); // デフォルトのEnterキー動作（改行）をキャンセル
            sendMessage();
        }
    });

    uploadButton.addEventListener('click', () => {
        fileInput.click(); // 非表示のファイル入力をクリックさせる
    });

    fileInput.addEventListener('change', (event: Event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0]; // Optional chaining

        if (file && file.type === 'application/pdf') {
            currentFile = file;
            currentFileId = null; // 新しいファイルが選択されたらFile IDをリセット
            updateSelectedFileUI();
            if (errorMessageDiv) errorMessageDiv.textContent = ''; // エラーメッセージをクリア
        } else if (file) {
            handleError('PDFファイルのみアップロードできます。');
            clearFileSelection();
        }
        // ファイル選択がキャンセルされた場合は何もしない
    });

    clearFileButton.addEventListener('click', clearFileSelection);
}

// --- 初期化実行 ---
// DOMが完全に読み込まれてから初期化とイベントリスナー設定を行う
document.addEventListener('DOMContentLoaded', () => {
    initializeChat();
    setupEventListeners();
}); 