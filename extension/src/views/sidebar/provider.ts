/**
 * Sidebar status view provider - 简化版
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// 请求目录
const PENDING_DIR = path.join(os.homedir(), ".session-helper", "requests", "pending");
const COMPLETED_DIR = path.join(os.homedir(), ".session-helper", "requests", "completed");

interface RequestFile {
  id: string;
  project?: string;
  summary?: string;
  createdAt?: string;
}

export class StatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ioUtil.statusView";
  private _view?: vscode.WebviewView;
  private _serverRunning = false;
  private _requestCount = 0;
  private _pendingRequests: RequestFile[] = [];
  private _templatePath: string;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._templatePath = path.join(_extensionUri.fsPath, "dist", "views", "sidebar", "sidebar.html");
  }

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
          vscode.commands.executeCommand("ioUtil.restart");
          break;
        case "showStatus":
          vscode.commands.executeCommand("ioUtil.showStatus");
          break;
        case "openPanel":
          vscode.commands.executeCommand("ioUtil.openPanel");
          break;
        case "refreshSessions":
          this._fetchRequests();
          break;
        case "deleteSession":
          this._deleteRequest(message.requestId);
          break;
      }
    });

    // 初始加载请求
    this._fetchRequests();
  }

  public updateStatus(running: boolean, _port: number) {
    this._serverRunning = running;
    this._refreshView();
  }

  public incrementRequestCount() {
    this._requestCount++;
    this._fetchRequests();
  }

  private _refreshView() {
    if (this._view) {
      this._view.webview.html = this._getHtmlContent();
    }
  }

  private _fetchRequests() {
    this._pendingRequests = [];
    
    // 读取 pending 目录
    try {
      if (fs.existsSync(PENDING_DIR)) {
        const files = fs.readdirSync(PENDING_DIR);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const content = fs.readFileSync(path.join(PENDING_DIR, file), "utf-8");
            const data = JSON.parse(content);
            this._pendingRequests.push(data);
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch {
      // 目录不存在
    }

    // 读取 completed 目录（最近 5 个）
    try {
      if (fs.existsSync(COMPLETED_DIR)) {
        const files = fs.readdirSync(COMPLETED_DIR)
          .filter(f => f.endsWith(".json"))
          .slice(0, 5);
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(COMPLETED_DIR, file), "utf-8");
            const data = JSON.parse(content);
            data._completed = true;
            this._pendingRequests.push(data);
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch {
      // 目录不存在
    }

    this._requestCount = this._pendingRequests.length;
    this._refreshView();
  }

  private _deleteRequest(requestId: string) {
    // 删除 pending 或 completed 中的文件
    const pendingFile = path.join(PENDING_DIR, `${requestId}.json`);
    const completedFile = path.join(COMPLETED_DIR, `${requestId}.json`);
    
    try {
      if (fs.existsSync(pendingFile)) {
        fs.unlinkSync(pendingFile);
      }
      if (fs.existsSync(completedFile)) {
        fs.unlinkSync(completedFile);
      }
      vscode.window.showInformationMessage(`Request ${requestId.substring(0, 8)}... deleted`);
      this._fetchRequests();
    } catch (err) {
      vscode.window.showWarningMessage(`Delete failed: ${err}`);
    }
  }

  private _getHtmlContent(): string {
    const statusIcon = this._serverRunning ? "🟢" : "🔴";
    const statusText = this._serverRunning ? "Running" : "Stopped";
    const statusClass = this._serverRunning ? "running" : "stopped";
    
    const sessionsHtml = this._buildSessionsHtml();

    try {
      let template = fs.readFileSync(this._templatePath, "utf-8");
      return template
        .replace(/\{\{STATUS_ICON\}\}/g, statusIcon)
        .replace(/\{\{STATUS_TEXT\}\}/g, statusText)
        .replace(/\{\{STATUS_CLASS\}\}/g, statusClass)
        .replace(/\{\{REQUEST_COUNT\}\}/g, String(this._requestCount))
        .replace(/\{\{SESSIONS_HTML\}\}/g, sessionsHtml);
    } catch {
      return this._getFallbackHtml(statusIcon, statusText);
    }
  }

  private _buildSessionsHtml(): string {
    if (this._pendingRequests.length === 0) {
      return `<div class="empty-state">No requests</div>`;
    }

    return this._pendingRequests.map(req => {
      const shortId = req.id.substring(0, 8);
      const isCompleted = (req as any)._completed;
      const statusClass = isCompleted ? "completed" : "pending";
      const statusText = isCompleted ? "done" : "pending";
      const summary = (req.summary || "").length > 40 
        ? req.summary?.substring(0, 40) + "..." 
        : req.summary || "No summary";
      
      return `
        <div class="session-item">
          <div class="session-header">
            <span class="session-id" title="${req.id}">${shortId}...</span>
            <span class="session-status ${statusClass}">${statusText}</span>
          </div>
          <div class="session-reason" title="${this._escapeHtml(req.summary || "")}">${this._escapeHtml(summary)}</div>
          <div class="session-actions">
            <button class="action-btn" onclick="deleteSession('${req.id}')">🗑️ Delete</button>
          </div>
        </div>
      `;
    }).join("");
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private _getFallbackHtml(icon: string, text: string): string {
    return `<!DOCTYPE html><html><body>
      <p>${icon} ${text}</p>
      <p>Requests: ${this._requestCount}</p>
    </body></html>`;
  }
}
