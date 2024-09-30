import * as vscode from 'vscode';
import axios from 'axios'; // axiosをインポート

// WebviewViewProviderを実装するクラス
class ChatGptViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'chatGptSidebar';

    constructor(private readonly context: vscode.ExtensionContext) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        console.log('resolveWebviewView called');

        webviewView.webview.options = {
            enableScripts: true
        };

        webviewView.webview.html = this.getWebviewContent();

        // メッセージ受信時のハンドリング
        webviewView.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendMessage':
                        const response = await this.getChatGptResponse(message.text);
                        webviewView.webview.postMessage({ command: 'response', text: response });
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private getWebviewContent(): string {
        return `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
            <meta charset="UTF-8">
            <title>ChatGPT</title>
            <style>
                body { font-family: sans-serif; padding: 10px; }
                #chatBox { width: 100%; height: 300px; border: 1px solid #ccc; padding: 5px; overflow-y: scroll; }
                #userInput { width: 80%; }
                #sendButton { width: 18%; }
            </style>
        </head>
        <body>
            <div id="chatBox"></div>
            <input type="text" id="userInput" placeholder="メッセージを入力してください" />
            <button id="sendButton">送信</button>

            <script>
                const vscode = acquireVsCodeApi();

                document.getElementById('sendButton').addEventListener('click', () => {
                    const input = document.getElementById('userInput').value;
                    if (input.trim() === '') return;
                    appendMessage('あなた', input);
                    vscode.postMessage({ command: 'sendMessage', text: input });
                    document.getElementById('userInput').value = '';
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'response':
                            appendMessage('ChatGPT', message.text);
                            break;
                    }
                });

                function appendMessage(sender, text) {
                    const chatBox = document.getElementById('chatBox');
                    const messageElem = document.createElement('div');
                    messageElem.innerHTML = '<strong>' + sender + ':</strong> ' + text;
                    chatBox.appendChild(messageElem);
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            </script>
        </body>
        </html>
        `;
    }

    private async getChatGptResponse(prompt: string): Promise<string> {
        const config = vscode.workspace.getConfiguration('vscode-chatgpt');
        const apiKey = config.get<string>('chatGptApiKey');

        if (!apiKey) {
            return 'APIキーが設定されていません。設定からOpenAIのAPIキーを入力してください。';
        }

        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }
            });

            const data = response.data;

            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                return data.choices[0].message.content.trim();
            } else {
                return '予期しないレスポンス形式です。';
            }
        } catch (error: any) {
            if (error.response) {
                // サーバーからのエラーレスポンス
                return `エラー: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
            } else if (error.request) {
                // リクエストが送信されたがレスポンスが受信できなかった場合
                return 'エラー: レスポンスが受信できませんでした。';
            } else {
                // その他のエラー
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

    // コマンドを登録
    let disposable = vscode.commands.registerCommand('chatgpt.sayHello', () => {
        vscode.window.showInformationMessage('Hello from ChatGPT extension!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
