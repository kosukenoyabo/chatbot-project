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
// DOM要素の取得と型付け
const chatbox = document.getElementById('chatbox');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const uploadButton = document.getElementById('upload-button');
const fileInput = document.getElementById('file-input');
const selectedFileSpan = document.getElementById('selected-file');
const clearFileButton = document.getElementById('clear-file-button');
const loadingDiv = document.getElementById('loading');
const errorMessageDiv = document.getElementById('error-message');
// 状態変数
let threadId = null;
let currentFile = null;
let currentFileId = null; // アップロード後のFile IDを保持
// --- 初期化処理 ---
function initializeChat() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Initializing chat...');
        showLoading(true);
        if (errorMessageDiv)
            errorMessageDiv.textContent = '';
        // DOM要素の存在チェック
        if (!chatbox || !messageInput || !sendButton || !uploadButton || !fileInput || !selectedFileSpan || !clearFileButton || !loadingDiv || !errorMessageDiv) {
            console.error("必要なDOM要素が見つかりません。");
            handleError('ページの初期化に失敗しました。');
            showLoading(false);
            return;
        }
        try {
            const response = yield fetch('/api/start-chat', { method: 'POST' });
            if (!response.ok) {
                const errorData = yield response.json().catch(() => ({}));
                throw new Error(errorData.error || `サーバーエラー: ${response.status}`);
            }
            const data = yield response.json();
            threadId = data.threadId;
            console.log('Chat initialized. Thread ID:', threadId);
            addMessageToChatbox('assistant', 'こんにちは！どのようなご用件でしょうか？PDFファイルをアップロードして質問することもできます。');
        }
        catch (error) {
            console.error('Error initializing chat:', error);
            handleError(`チャットの開始に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            showLoading(false);
        }
    });
}
// --- メッセージ送信処理 ---
function sendMessage() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!messageInput || !sendButton)
            return; // DOM要素チェック
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
        if (errorMessageDiv)
            errorMessageDiv.textContent = '';
        let userMessageContent = message;
        try {
            // 1. ファイルが選択されていればアップロード
            if (currentFile && !currentFileId) { // まだアップロードされていない場合のみ
                addMessageToChatbox('system', `「${currentFile.name}」をアップロード中...`);
                currentFileId = yield uploadFile(currentFile);
                addMessageToChatbox('system', `「${currentFile.name}」のアップロード完了 (File ID: ${currentFileId})`);
                // ファイル名をメッセージに追加（任意）
                if (message) {
                    userMessageContent = `ファイル「${currentFile.name}」について: ${message}`;
                }
                else {
                    userMessageContent = `ファイル「${currentFile.name}」について質問があります。`;
                }
            }
            // 2. ユーザーメッセージをチャットに追加
            const displayMessage = userMessageContent || `ファイル「${(currentFile === null || currentFile === void 0 ? void 0 : currentFile.name) || 'アップロード済みファイル'}」について`;
            if (message || currentFileId) { // メッセージがあるか、ファイルがアップロードされた場合
                addMessageToChatbox('user', displayMessage);
            }
            // 3. チャットAPIにメッセージ送信
            const requestBody = {
                threadId: threadId,
                // メッセージが空でもファイルがあればファイルに関する質問とする
                message: message || `ファイル「${(currentFile === null || currentFile === void 0 ? void 0 : currentFile.name) || 'アップロード済みファイル'}」について質問があります。`,
                fileId: currentFileId // アップロード済みのFile IDを渡す (nullの場合もある)
            };
            const response = yield fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorData = yield response.json().catch(() => ({}));
                throw new Error(errorData.error || `サーバーエラー: ${response.status}`);
            }
            const data = yield response.json();
            // 4. アシスタントの応答をチャットに追加
            addMessageToChatbox('assistant', data.response);
            // 5. 入力とファイル選択をクリア
            messageInput.value = '';
            clearFileSelection(); // ファイルIDもクリア
        }
        catch (error) {
            console.error('Error sending message:', error);
            handleError(`メッセージの送信中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            showLoading(false);
            sendButton.disabled = false;
            messageInput.focus(); // 入力フィールドにフォーカスを戻す
        }
    });
}
// --- ファイルアップロード処理 ---
function uploadFile(file) {
    return __awaiter(this, void 0, void 0, function* () {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = yield fetch('/api/upload-pdf', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                // upload API は error ではなく message を返すことがあるため両方チェック
                const errorData = yield response.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || `アップロードエラー: ${response.status}`);
            }
            const data = yield response.json();
            if (!data.fileId) {
                throw new Error('サーバーからFile IDが返されませんでした。');
            }
            return data.fileId; // File IDを返す
        }
        catch (error) {
            console.error('Error uploading file:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            handleError(`ファイルのアップロードに失敗しました: ${errorMessage}`);
            clearFileSelection(); // エラー時はファイル選択もクリア
            // エラーを再スローして sendMessage で処理できるようにする
            throw new Error(errorMessage);
        }
    });
}
function addMessageToChatbox(sender, message) {
    if (!chatbox)
        return;
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
function showLoading(isLoading) {
    if (loadingDiv) {
        loadingDiv.style.display = isLoading ? 'block' : 'none';
    }
}
function handleError(message) {
    if (errorMessageDiv) {
        errorMessageDiv.textContent = message;
    }
}
function updateSelectedFileUI() {
    if (!selectedFileSpan || !clearFileButton)
        return;
    if (currentFile) {
        selectedFileSpan.textContent = currentFile.name;
        clearFileButton.style.display = 'inline-block';
    }
    else {
        selectedFileSpan.textContent = 'なし';
        clearFileButton.style.display = 'none';
    }
}
function clearFileSelection() {
    currentFile = null;
    currentFileId = null; // File IDもクリア
    if (fileInput)
        fileInput.value = ''; // input要素の値もクリア
    updateSelectedFileUI();
}
// --- イベントリスナー設定 ---
function setupEventListeners() {
    if (!sendButton || !messageInput || !uploadButton || !fileInput || !clearFileButton) {
        console.warn("一部のDOM要素が見つからないため、イベントリスナーを設定できません。");
        return;
    }
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { // Shift+Enterでの改行を許可
            event.preventDefault(); // デフォルトのEnterキー動作（改行）をキャンセル
            sendMessage();
        }
    });
    uploadButton.addEventListener('click', () => {
        fileInput.click(); // 非表示のファイル入力をクリックさせる
    });
    fileInput.addEventListener('change', (event) => {
        var _a;
        const target = event.target;
        const file = (_a = target.files) === null || _a === void 0 ? void 0 : _a[0]; // Optional chaining
        if (file && file.type === 'application/pdf') {
            currentFile = file;
            currentFileId = null; // 新しいファイルが選択されたらFile IDをリセット
            updateSelectedFileUI();
            if (errorMessageDiv)
                errorMessageDiv.textContent = ''; // エラーメッセージをクリア
        }
        else if (file) {
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
//# sourceMappingURL=script.js.map