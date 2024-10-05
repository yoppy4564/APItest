import * as vscode from 'vscode';
import axios from 'axios';

class ChatGptViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'chatGptSidebar';
    private conversationHistory: { role: string; content: string }[] = [];

    constructor(private readonly context: vscode.ExtensionContext) {
        // 保存された会話履歴を読み込む
        this.conversationHistory = context.workspaceState.get('conversationHistory', []);
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media')
            ]
        };

        webviewView.webview.html = this.getWebviewContent(webviewView.webview);

        // Webviewからのメッセージを処理
        webviewView.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendMessage':
                        this.conversationHistory.push({ role: 'user', content: message.text });

                        // 会話履歴の長さを制限（最大20メッセージ）
                        const maxHistoryLength = 20;
                        if (this.conversationHistory.length > maxHistoryLength) {
                            this.conversationHistory.splice(0, this.conversationHistory.length - maxHistoryLength);
                        }

                        // ローディング表示を開始
                        webviewView.webview.postMessage({ command: 'loading' });

                        const responseText = await this.getChatGptResponse();

                        // ローディング表示を終了し、レスポンスを送信
                        webviewView.webview.postMessage({ command: 'response', text: responseText });

                        // 会話履歴を保存
                        this.context.workspaceState.update('conversationHistory', this.conversationHistory);
                        return;

                    case 'clearConversation':
                        this.conversationHistory = [];
                        webviewView.webview.postMessage({ command: 'conversationCleared' });

                        // 会話履歴を保存
                        this.context.workspaceState.update('conversationHistory', this.conversationHistory);
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Webviewが読み込まれたときに会話履歴を送信
        webviewView.webview.postMessage({ command: 'loadHistory', history: this.conversationHistory });

        // Webviewが復元されたときに会話履歴を再送信
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                webviewView.webview.postMessage({ command: 'loadHistory', history: this.conversationHistory });
            }
        });
    }

    private getWebviewContent(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'script.js')
        );
        const markedUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'marked.min.js')
        );

        return `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <title>ChatGPT</title>
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            <div id="chatContainer">
                <div id="chatBox"></div>
            </div>
            <div id="inputContainer">
                <textarea id="userInput" placeholder="メッセージを入力"></textarea>
                <button id="sendButton">➤</button>
                <button id="clearButton">クリア</button>
            </div>
            <script src="${markedUri}"></script>
            <script src="${scriptUri}"></script>
        </body>
        </html>
        `;
    }

    private async getChatGptResponse(): Promise<string> {
        const config = vscode.workspace.getConfiguration('vscode-chatgpt');
        const apiKey = config.get<string>('chatGptApiKey');

        if (!apiKey) {
            return 'APIキーが設定されていません。設定からOpenAIのAPIキーを入力してください。';
        }

        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-3.5-turbo',
                    messages: this.conversationHistory,
                    max_tokens: 2048, // 必要に応じて調整
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    // タイムアウトを設定（必要に応じて）
                    timeout: 60000, // 60秒
                }
            );

            const data = response.data;

            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                const assistantMessage = data.choices[0].message.content.trim();

                this.conversationHistory.push({ role: 'assistant', content: assistantMessage });

                // 会話履歴を保存
                this.context.workspaceState.update('conversationHistory', this.conversationHistory);

                return assistantMessage;
            } else {
                return '予期しないレスポンス形式です。';
            }
        } catch (error: any) {
            if (error.response) {
                return `エラー: ${error.response.status} - ${error.response.data.error.message}`;
            } else if (error.request) {
                return 'エラー: レスポンスが受信できませんでした。ネットワークを確認してください。';
            } else {
                return `エラーが発生しました: ${error.message || error}`;
            }
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('ChatGPT extension is now active.');

    const provider = new ChatGptViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatGptViewProvider.viewType, provider)
    );

    let disposable = vscode.commands.registerCommand('chatgpt.sayHello', () => {
        vscode.window.showInformationMessage('Hello from ChatGPT extension!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
