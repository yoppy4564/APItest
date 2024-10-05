const vscode = acquireVsCodeApi();
let isLoading = false;

document.getElementById('sendButton').addEventListener('click', sendMessage);

document.getElementById('userInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        // Ctrl+Enter または Command+Enterでメッセージを送信
        event.preventDefault();
        sendMessage();
    }
    // Enterキーのみの場合は改行を挿入（デフォルトの動作）
});

document.getElementById('clearButton').addEventListener('click', () => {
    vscode.postMessage({ command: 'clearConversation' });
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = '';
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'response':
            removeLoading();
            appendMessage('ChatGPT', message.text);
            break;
        case 'loadHistory':
            const chatBox = document.getElementById('chatBox');
            chatBox.innerHTML = ''; // 古い内容をクリア
            message.history.forEach(entry => {
                const sender = entry.role === 'user' ? 'あなた' : 'ChatGPT';
                appendMessage(sender, entry.content);
            });
            break;
        case 'conversationCleared':
            const chatBoxCleared = document.getElementById('chatBox');
            chatBoxCleared.innerHTML = '';
            break;
        case 'loading':
            displayLoading();
            break;
    }
});

function sendMessage() {
    const input = document.getElementById('userInput').value;
    if (input.trim() === '') return;
    appendMessage('あなた', input);
    vscode.postMessage({ command: 'sendMessage', text: input });
    displayLoading(); // メッセージ送信後にローディング表示
    document.getElementById('userInput').value = '';
}

function appendMessage(sender, text) {
    const chatBox = document.getElementById('chatBox');
    const messageElem = document.createElement('div');
    messageElem.classList.add('message');

    if (sender === 'あなた') {
        messageElem.classList.add('userMessage');
    } else {
        messageElem.classList.add('assistantMessage');
    }

    messageElem.innerHTML = marked.parse(text);
    chatBox.appendChild(messageElem);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function displayLoading() {
    if (isLoading) return; // 既にローディング表示中なら何もしない
    isLoading = true;
    const chatBox = document.getElementById('chatBox');
    const loadingElem = document.createElement('div');
    loadingElem.id = 'loading';
    loadingElem.classList.add('loading');
    loadingElem.innerText = 'ChatGPT is typing...';
    chatBox.appendChild(loadingElem);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function removeLoading() {
    const loadingElem = document.getElementById('loading');
    if (loadingElem) {
        loadingElem.remove();
        isLoading = false;
    }
}
