import * as vscode from "vscode";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";

const MCP_CALLBACK_PORT = 23984; // Port where MCP server listens for responses
const PORT_FILE_DIR = path.join(os.tmpdir(), "uio-ports");

interface AskRequest {
  type: string;
  requestId: string;
  reason: string;
  options?: string[];  // 预定义选项
  callbackPort?: number;  // MCP 服务器的回调端口
}

let server: http.Server | null = null;
let statusBarItem: vscode.StatusBarItem;
let statusViewProvider: StatusViewProvider;
let lastPendingRequest: AskRequest | null = null; // 保存最近的待处理请求
let lastPendingRequestTime: number = 0; // 请求时间戳，用于判断请求是否过期

/**
 * 侧边栏状态视图
 */
class StatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "sessionHelper.statusView";
  private _view?: vscode.WebviewView;
  private _serverRunning = false;
  private _port = 23983;
  private _requestCount = 0;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent();

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "restart":
          vscode.commands.executeCommand("sessionHelper.restart");
          break;
        case "showStatus":
          vscode.commands.executeCommand("sessionHelper.showStatus");
          break;
        case "openPanel":
          vscode.commands.executeCommand("sessionHelper.openPanel");
          break;
      }
    });
  }

  public updateStatus(running: boolean, port: number) {
    this._serverRunning = running;
    this._port = port;
    if (this._view) {
      this._view.webview.html = this._getHtmlContent();
    }
  }

  public incrementRequestCount() {
    this._requestCount++;
    if (this._view) {
      this._view.webview.html = this._getHtmlContent();
    }
  }

  private _getHtmlContent(): string {
    const statusIcon = this._serverRunning ? "🟢" : "🔴";
    const statusText = this._serverRunning ? "Running" : "Stopped";
    const statusClass = this._serverRunning ? "running" : "stopped";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 15px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
    }
    .title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-card {
      background: var(--vscode-editor-background);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .status-row:last-child {
      margin-bottom: 0;
    }
    .label {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .value {
      font-size: 13px;
      font-weight: 500;
    }
    .value.running {
      color: #4ec9b0;
    }
    .value.stopped {
      color: #f14c4c;
    }
    .btn {
      width: 100%;
      padding: 8px 12px;
      margin-top: 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .info-box {
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
      padding: 10px;
      margin-top: 12px;
      font-size: 11px;
      line-height: 1.5;
      color: var(--vscode-descriptionForeground);
    }
    .info-box strong {
      color: var(--vscode-foreground);
    }
  </style>
</head>
<body>
  <div class="title">
    ⚡ Session Helper
  </div>
  
  <div class="status-card">
    <div class="status-row">
      <span class="label">Status</span>
      <span class="value ${statusClass}">${statusIcon} ${statusText}</span>
    </div>
    <div class="status-row">
      <span class="label">Port</span>
      <span class="value">${this._port}</span>
    </div>
    <div class="status-row">
      <span class="label">Sessions</span>
      <span class="value">${this._requestCount}</span>
    </div>
  </div>
  
  <button class="btn btn-primary" onclick="openPanel()">📋 Reopen Panel</button>
  <button class="btn" onclick="restart()">🔄 Restart</button>
  
  <div class="info-box">
    <strong>Tip:</strong> Click the button above to reopen the panel if accidentally closed.
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    function openPanel() {
      vscode.postMessage({ command: 'openPanel' });
    }
    function restart() {
      vscode.postMessage({ command: 'restart' });
    }
  </script>
</body>
</html>`;
  }
}

/**
 * Send response back to MCP server
 */
async function sendResponseToMCP(
  requestId: string,
  userInput: string,
  cancelled: boolean,
  callbackPort?: number
): Promise<void> {
  const port = callbackPort || MCP_CALLBACK_PORT;
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      requestId,
      userInput,
      cancelled,
    });

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: port,
        path: "/response",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 5000,
      },
      (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          // 200 = 成功, 404 = 请求已过期/不存在（静默处理）
          resolve();
        } else {
          reject(new Error(`MCP server returned status ${res.statusCode}`));
        }
      }
    );

    req.on("error", (e) => {
      reject(new Error(`Failed to send response to --: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Show the Session Checkpoint dialog
 */
async function showSessionCheckpointDialog(request: AskRequest): Promise<void> {
  // 保存当前请求，以便重新打开
  lastPendingRequest = request;
  lastPendingRequestTime = Date.now();
  
  let panel: vscode.WebviewPanel;
  try {
    panel = vscode.window.createWebviewPanel(
    "sessionHelper",
    "Session Checkpoint",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  panel.webview.html = getWebviewContent(request.reason, request.requestId, request.options || []);
  } catch (err) {
    // Webview 创建失败，发送取消响应
    console.error("[--] Failed to create webview panel:", err);
    lastPendingRequest = null;
    try {
      await sendResponseToMCP(request.requestId, "", true, request.callbackPort);
    } catch {
      // 忽略发送错误
    }
    vscode.window.showErrorMessage(`Session Helper: Failed to create panel - ${err instanceof Error ? err.message : "Unknown error"}`);
    return;
  }

  // 标记是否已发送响应，避免重复发送
  let responseSent = false;

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (responseSent) return;
      
      switch (message.command) {
        case "continue":
          try {
            responseSent = true;
            lastPendingRequest = null; // 清除待处理请求
            await sendResponseToMCP(request.requestId, message.text, false, request.callbackPort);
            panel.dispose();
          } catch (error) {
            responseSent = false;
            vscode.window.showErrorMessage(
              `Failed to send response: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
          break;
        case "end":
          try {
            responseSent = true;
            await sendResponseToMCP(request.requestId, "", false, request.callbackPort);
            panel.dispose();
          } catch (error) {
            responseSent = false;
            vscode.window.showErrorMessage(
              `Failed to send response: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
          break;
        case "cancel":
          try {
            responseSent = true;
            await sendResponseToMCP(request.requestId, "", true, request.callbackPort);
            panel.dispose();
          } catch (error) {
            // Ignore errors on cancel
          }
          break;
      }
    },
    undefined,
    []
  );

  // Handle panel close (treat as cancel only if no response sent yet)
  panel.onDidDispose(async () => {
    // 清除待处理请求（无论是否已发送响应）
    if (lastPendingRequest?.requestId === request.requestId) {
      lastPendingRequest = null;
    }
    if (responseSent) return;
    try {
      await sendResponseToMCP(request.requestId, "", true, request.callbackPort);
    } catch {
      // Ignore errors on dispose
    }
  });
}

/**
 * Generate webview HTML content
 */
function getWebviewContent(reason: string, requestId: string, options: string[] = []): string {
  const optionsHtml = options.length > 0 ? `
    <div class="options-section">
      <div class="options-label">Quick options:</div>
      <div class="options-buttons">
        ${options.map((opt, i) => `<button class="option-btn" data-option="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
      </div>
    </div>
  ` : '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Checkpoint</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      padding: 20px;
      color: var(--vscode-foreground, #cccccc);
      background-color: var(--vscode-editor-background, #1e1e1e);
      min-height: 100vh;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--vscode-panel-border, #454545);
    }
    .header-icon {
      font-size: 24px;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
      color: var(--vscode-foreground, #cccccc);
    }
    .reason-box {
      background-color: var(--vscode-textBlockQuote-background, #2d2d2d);
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
      padding: 12px 15px;
      margin-bottom: 20px;
      border-radius: 0 4px 4px 0;
    }
    .reason-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #888888);
      margin-bottom: 5px;
    }
    .reason-text {
      font-size: 14px;
      line-height: 1.5;
    }
    .input-section {
      margin-bottom: 20px;
    }
    .input-label {
      display: block;
      font-size: 13px;
      color: var(--vscode-foreground, #cccccc);
      margin-bottom: 8px;
    }
    .optional {
      color: var(--vscode-descriptionForeground, #888888);
      font-weight: normal;
    }
    textarea {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
      font-size: 13px;
      line-height: 1.5;
      color: var(--vscode-input-foreground, #cccccc);
      background-color: var(--vscode-input-background, #3c3c3c);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 4px;
      resize: vertical;
      outline: none;
    }
    textarea:focus {
      border-color: var(--vscode-focusBorder, #007fd4);
    }
    textarea::placeholder {
      color: var(--vscode-input-placeholderForeground, #888888);
    }
    .button-group {
      display: flex;
      gap: 10px;
    }
    button {
      flex: 1;
      padding: 10px 20px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
    button:active {
      opacity: 0.8;
    }
    .btn-primary {
      background-color: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
    }
    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }
    .shortcuts {
      margin-top: 15px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888888);
      text-align: center;
    }
    .shortcuts kbd {
      background-color: var(--vscode-keybindingLabel-background, #464646);
      border: 1px solid var(--vscode-keybindingLabel-border, #5a5a5a);
      border-radius: 3px;
      padding: 1px 5px;
      font-family: inherit;
    }
    .upload-section {
      margin-bottom: 15px;
    }
    .upload-options {
      display: flex;
      gap: 15px;
      margin-bottom: 10px;
    }
    .upload-options label {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #888888);
      cursor: pointer;
    }
    .upload-hint {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #888888);
      text-align: center;
      padding: 15px;
      border: 1px dashed var(--vscode-panel-border, #454545);
      border-radius: 4px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: border-color 0.2s, background-color 0.2s;
    }
    .upload-hint:hover {
      border-color: var(--vscode-focusBorder, #007fd4);
      background-color: var(--vscode-list-hoverBackground, #2a2d2e);
    }
    .upload-hint.has-image {
      border-color: var(--vscode-textLink-foreground, #3794ff);
      padding: 10px;
    }
    .image-preview {
      max-width: 100%;
      max-height: 150px;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .image-info {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888888);
    }
    .remove-image {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
      border: none;
      border-radius: 3px;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      margin-top: 8px;
    }
    .remove-image:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    .options-section {
      margin-bottom: 15px;
    }
    .options-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #888888);
      margin-bottom: 8px;
    }
    .options-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .option-btn {
      padding: 8px 16px;
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
      border: 1px solid var(--vscode-button-border, #454545);
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }
    .option-btn:hover {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
      border-color: var(--vscode-button-background, #0e639c);
    }
    .option-btn:active {
      transform: translateY(1px);
      background: var(--vscode-button-hoverBackground, #1177bb);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="header-icon">🔄</span>
      <h1>Session Checkpoint</h1>
    </div>
    
    <div class="reason-box">
      <div class="reason-label">Current status:</div>
      <div class="reason-text">${escapeHtml(reason)}</div>
    </div>
    
    ${optionsHtml}
    
    <div class="input-section">
      <label class="input-label">
        Additional instructions <span class="optional">(optional)</span>:
      </label>
      <textarea 
        id="userInput" 
        placeholder="Enter your next instruction..."
        autofocus
      ></textarea>
    </div>

    <div class="upload-section">
      <div class="upload-options">
        <label>Upload image (optional):</label>
        <label><input type="radio" name="uploadType" value="base64" checked> Image content (Base64)</label>
        <label><input type="radio" name="uploadType" value="path"> Path only</label>
      </div>
      <div class="upload-hint" id="dropZone">
        <span id="dropText">📋 Ctrl+V to paste or drag image here</span>
        <div id="imagePreviewContainer" style="display: none;">
          <img id="imagePreview" class="image-preview" />
          <div class="image-info" id="imageInfo"></div>
          <button type="button" class="remove-image" id="removeImage">✕ Remove</button>
        </div>
      </div>
    </div>
    
    <div class="button-group">
      <button class="btn-primary" id="continueBtn">▶ Continue</button>
      <button class="btn-secondary" id="endBtn">■ End Session</button>
    </div>
    
    <div class="shortcuts">
      Shortcuts: <kbd>Esc</kbd> = End Session | Click <strong>Continue</strong> button to proceed
    </div>
  </div>
  
  <script>
    console.log('[TS] Script starting...');
    const vscode = acquireVsCodeApi();
    console.log('[TS] vscode API acquired');
    const textarea = document.getElementById('userInput');
    const continueBtn = document.getElementById('continueBtn');
    const endBtn = document.getElementById('endBtn');
    const dropZone = document.getElementById('dropZone');
    const dropText = document.getElementById('dropText');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const imageInfo = document.getElementById('imageInfo');
    const removeImageBtn = document.getElementById('removeImage');
    
    let currentImageBase64 = null;
    
    // Focus textarea on load
    textarea.focus();
    
    // Handle keyboard shortcuts
    // Note: Enter key disabled to prevent accidental submission while typing
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        submitEnd();
      }
    });
    
    // Handle paste event for images (Ctrl+V)
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
          }
          break;
        }
      }
    });
    
    // Handle drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--vscode-focusBorder, #007fd4)';
      dropZone.style.backgroundColor = 'var(--vscode-list-hoverBackground, #2a2d2e)';
    });
    
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!currentImageBase64) {
        dropZone.style.borderColor = '';
        dropZone.style.backgroundColor = '';
      }
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '';
      dropZone.style.backgroundColor = '';
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          handleImageFile(file);
        }
      }
    });
    
    // Handle image file
    function handleImageFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        currentImageBase64 = e.target.result;
        imagePreview.src = currentImageBase64;
        imageInfo.textContent = file.name + ' (' + formatFileSize(file.size) + ')';
        dropText.style.display = 'none';
        imagePreviewContainer.style.display = 'block';
        dropZone.classList.add('has-image');
      };
      reader.readAsDataURL(file);
    }
    
    // Format file size
    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    // Remove image
    removeImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentImageBase64 = null;
      imagePreview.src = '';
      imageInfo.textContent = '';
      dropText.style.display = 'block';
      imagePreviewContainer.style.display = 'none';
      dropZone.classList.remove('has-image');
    });
    
    // Handle predefined option buttons
    console.log('[TS] Found option buttons:', document.querySelectorAll('.option-btn').length);
    document.querySelectorAll('.option-btn').forEach((btn, idx) => {
      console.log('[TS] Binding click to option button', idx, btn.textContent);
      btn.addEventListener('click', (e) => {
        console.log('[TS] Option button clicked!');
        // Use currentTarget to ensure we get the button element, not a child
        const target = e.currentTarget;
        const option = target.getAttribute('data-option') || '';
        console.log('[TS] Option value:', option);
        
        // Visual feedback
        target.style.opacity = '0.5';
        target.textContent = 'Sending...';
        
        console.log('[TS] Sending postMessage for option...');
        vscode.postMessage({ command: 'continue', text: option, hasImage: false });
        console.log('[TS] postMessage sent!');
      });
    });
    
    // Button handlers
    continueBtn.addEventListener('click', submitContinue);
    endBtn.addEventListener('click', submitEnd);
    
    function submitContinue() {
      console.log('[TS] Continue button clicked!');
      // Visual feedback immediately
      continueBtn.textContent = 'Sending...';
      continueBtn.disabled = true;
      
      let text = textarea.value.trim();
      console.log('[TS] Text value:', text);
      
      // If there's an image, append it to the message
      if (currentImageBase64) {
        const uploadType = document.querySelector('input[name="uploadType"]:checked')?.value || 'base64';
        if (uploadType === 'base64') {
          text = (text ? text + '\\n\\n' : '') + '[图片已附加]\\n' + currentImageBase64;
        }
      }
      
      console.log('[TS] Sending postMessage for continue...');
      vscode.postMessage({ command: 'continue', text: text || '继续', hasImage: !!currentImageBase64 });
      console.log('[TS] postMessage sent!');
    }
    
    function submitEnd() {
      vscode.postMessage({ command: 'end' });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Start the HTTP server to receive requests from MCP
 */
function startServer(port: number, retryCount = 0): void {
  // 先安全关闭旧服务器
  if (server) {
    try {
      server.close();
    } catch {
      // 忽略关闭错误
    }
    server = null;
  }

  const newServer = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/ask") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const request = JSON.parse(body) as AskRequest;

          if (request.type === "io") {
            // Show dialog with error handling
            try {
              // 使用 await 确保 webview 创建完成
              await showSessionCheckpointDialog(request);
              
              // Update request count in sidebar
              statusViewProvider?.incrementRequestCount();

              // Respond that we received the request
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ success: true }));
            } catch (dialogErr) {
              console.error("[--] Error showing dialog:", dialogErr);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Failed to show dialog", details: String(dialogErr) }));
            }
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unknown request type" }));
          }
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  newServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      // 端口被占用，尝试下一个端口（最多重试3次）
      if (retryCount < 3) {
        const nextPort = port + 1;
        console.log(`Port ${port} in use, trying ${nextPort}...`);
        setTimeout(() => startServer(nextPort, retryCount + 1), 100);
      } else {
        updateStatusBar(false, port);
        vscode.window.showWarningMessage(
          `Session Helper: Ports ${port - 3} - ${port} are all in use, server not started`
        );
      }
    } else {
      updateStatusBar(false, port);
      console.error(`Session Helper server error: ${err.message}`);
    }
  });

  newServer.listen(port, "127.0.0.1", () => {
    server = newServer;
    console.log(`Session Helper server listening on port ${port}`);
    updateStatusBar(true, port);
    
    // 写入端口文件，供 MCP 服务器发现
    writePortFile(port);
  });
}

/**
 * 写入端口文件，供 MCP 服务器发现
 */
function writePortFile(port: number): void {
  try {
    if (!fs.existsSync(PORT_FILE_DIR)) {
      fs.mkdirSync(PORT_FILE_DIR, { recursive: true });
    }
    // 使用进程 ID 作为文件名，确保多窗口不冲突
    const portFile = path.join(PORT_FILE_DIR, `${process.pid}.port`);
    fs.writeFileSync(portFile, JSON.stringify({ port, pid: process.pid, time: Date.now() }));
  } catch (e) {
    console.error("Failed to write port file:", e);
  }
}

/**
 * 清理端口文件
 */
function cleanupPortFile(): void {
  try {
    const portFile = path.join(PORT_FILE_DIR, `${process.pid}.port`);
    if (fs.existsSync(portFile)) {
      fs.unlinkSync(portFile);
    }
  } catch (e) {
    // 忽略清理错误
  }
}

/**
 * 清理旧的 MCP 回调端口进程（启动时自动调用）
 */
async function cleanupOldMcpProcesses(): Promise<void> {
  const isWindows = process.platform === "win32";
  
  // 清理端口 23984-24034 范围内的旧进程（MCP 回调端口范围）
  for (let port = 23984; port <= 24034; port++) {
    try {
      if (isWindows) {
        // Windows: 查找并结束占用端口的进程
        exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
          if (!err && stdout) {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && /^\d+$/.test(pid) && pid !== process.pid.toString()) {
                exec(`taskkill /F /PID ${pid}`, () => {
                  console.log(`[--] Killed old process on port ${port} (--: ${pid})`);
                });
              }
            }
          }
        });
      } else {
        // Unix/Mac: 使用 lsof
        exec(`lsof -ti:${port}`, (err, stdout) => {
          if (!err && stdout) {
            const pids = stdout.trim().split('\n');
            for (const pid of pids) {
              if (pid && pid !== process.pid.toString()) {
                exec(`kill -9 ${pid}`, () => {
                  console.log(`[--] Killed old process on port ${port} (--: ${pid})`);
                });
              }
            }
          }
        });
      }
    } catch (e) {
      // 忽略单个端口清理错误
    }
  }
  
  // 清理旧的端口文件
  try {
    if (fs.existsSync(PORT_FILE_DIR)) {
      const files = fs.readdirSync(PORT_FILE_DIR);
      for (const file of files) {
        if (file.endsWith('.port')) {
          const filePath = path.join(PORT_FILE_DIR, file);
          try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            // 如果进程已不存在，删除文件
            if (content.pid && content.pid !== process.pid) {
              if (isWindows) {
                exec(`tasklist /FI "PID eq ${content.pid}"`, (err, stdout) => {
                  if (!stdout || !stdout.includes(content.pid.toString())) {
                    fs.unlinkSync(filePath);
                  }
                });
              } else {
                exec(`ps -p ${content.pid}`, (err) => {
                  if (err) {
                    fs.unlinkSync(filePath);
                  }
                });
              }
            }
          } catch {
            fs.unlinkSync(filePath);
          }
        }
      }
    }
  } catch (e) {
    // 忽略清理错误
  }
}

/**
 * Update status bar and sidebar
 */
function updateStatusBar(running: boolean, port?: number): void {
  if (running && port) {
    statusBarItem.text = `$(check) TS: ${port}`;
    statusBarItem.tooltip = `Tool Sync running (port ${port})`;
    statusBarItem.backgroundColor = undefined;
    statusViewProvider?.updateStatus(true, port);
  } else {
    statusBarItem.text = "$(x) TS: Stopped";
    statusBarItem.tooltip = "Tool Sync not running";
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );
    statusViewProvider?.updateStatus(false, port || 23983);
  }
}

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log("Session Helper extension is now active");

  // Create sidebar view provider
  statusViewProvider = new StatusViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      StatusViewProvider.viewType,
      statusViewProvider
    )
  );

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "sessionHelper.showStatus";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Get configuration
  const config = vscode.workspace.getConfiguration("sessionHelper");
  const port = config.get<number>("serverPort", 23983);
  const autoStart = config.get<boolean>("autoStart", true);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("sessionHelper.showStatus", () => {
      const isRunning = server !== null && server.listening;
      vscode.window.showInformationMessage(
        `Session Helper status: ${isRunning ? `Running (port ${port})` : "Stopped"}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sessionHelper.restart", () => {
      const config = vscode.workspace.getConfiguration("sessionHelper");
      const port = config.get<number>("serverPort", 23983);
      startServer(port);
      vscode.window.showInformationMessage(`Session Helper restarted (port ${port})`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sessionHelper.openPanel", () => {
      if (lastPendingRequest) {
        // 检查请求是否过期（10分钟）
        const REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes
        if (Date.now() - lastPendingRequestTime > REQUEST_TIMEOUT) {
          lastPendingRequest = null;
          vscode.window.showWarningMessage("Session Helper: Request has expired");
          return;
        }
        showSessionCheckpointDialog(lastPendingRequest);
      } else {
        vscode.window.showInformationMessage("Session Helper: No pending requests");
      }
    })
  );

  // 启动时自动清理旧的 MCP 进程
  cleanupOldMcpProcesses().then(() => {
    console.log("[--] Old processes cleanup completed");
  });

  // Auto-start server
  if (autoStart) {
    startServer(port);
  } else {
    updateStatusBar(false);
  }

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("sessionHelper.serverPort")) {
        const newPort = vscode.workspace
          .getConfiguration("sessionHelper")
          .get<number>("serverPort", 23983);
        startServer(newPort);
      }
    })
  );
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  if (server) {
    server.close();
    server = null;
  }
}
