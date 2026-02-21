/**
 * Sidebar status view provider - 简化版
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { PendingRequest } from "../../types";
import { escapeHtml, deleteSessionImages } from "../../utils";
import { PENDING_DIR, COMPLETED_DIR } from "../../core/config";

export class StatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ioUtil.statusView";
  private _view?: vscode.WebviewView;
  private _serverRunning = false;
  private _requestCount = 0;
  private _pendingCount = 0;
  private _completedCount = 0;
  private _pendingRequests: PendingRequest[] = [];
  private _templatePath: string;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._templatePath = path.join(
      _extensionUri.fsPath,
      "dist",
      "views",
      "sidebar",
      "sidebar.html",
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    try {
      this._view = webviewView;

      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this._extensionUri],
      };

      webviewView.webview.html = this._getHtmlContent();

      webviewView.webview.onDidReceiveMessage((message) => {
        try {
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
            case "reopenSession":
              this._reopenRequest(message.requestId);
              break;
          }
        } catch (err) {
          vscode.window.showErrorMessage(`Error handling message: ${err}`);
        }
      });

      // 初始加载请求
      this._fetchRequests();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to resolve webview view: ${err}`);
      console.error(err);
    }
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
    const pendingRequests: PendingRequest[] = [];
    const completedRequests: PendingRequest[] = [];

    // 读取 pending 目录
    try {
      if (fs.existsSync(PENDING_DIR)) {
        const files = fs.readdirSync(PENDING_DIR);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const content = fs.readFileSync(
              path.join(PENDING_DIR, file),
              "utf-8",
            );
            const data = JSON.parse(content);
            // 验证必需字段
            if (data.id) {
              pendingRequests.push(data);
            }
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
        const files = fs
          .readdirSync(COMPLETED_DIR)
          .filter((f) => f.endsWith(".json"))
          .slice(0, 5);
        for (const file of files) {
          try {
            const content = fs.readFileSync(
              path.join(COMPLETED_DIR, file),
              "utf-8",
            );
            const data = JSON.parse(content);
            const requestId = data.id || data.requestId;
            // 验证必需字段
            if (requestId) {
              completedRequests.push({
                ...data,
                id: requestId,
                _completed: true,
              });
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch {
      // 目录不存在
    }
    this._pendingRequests = [...pendingRequests, ...completedRequests].sort(
      (a, b) => {
        const aCompleted = Boolean(a._completed);
        const bCompleted = Boolean(b._completed);
        if (aCompleted !== bCompleted) {
          return aCompleted ? 1 : -1;
        }
        const aTime = this._safeTimeValue(
          (a as PendingRequest & { timestamp?: string }).timestamp || a.createdAt,
        );
        const bTime = this._safeTimeValue(
          (b as PendingRequest & { timestamp?: string }).timestamp || b.createdAt,
        );
        return bTime - aTime;
      },
    );
    this._pendingCount = pendingRequests.length;
    this._completedCount = completedRequests.length;

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
      // 删除关联的图片目录
      deleteSessionImages(requestId);

      vscode.window.showInformationMessage(
        `Request ${requestId?.substring(0, 8) || 'Unknown'}... deleted`,
      );
      this._fetchRequests();
    } catch (err) {
      vscode.window.showWarningMessage(`Delete failed: ${err}`);
    }
  }

  private _reopenRequest(requestId: string) {
    // 从 pending 目录读取请求并打开对话框
    const pendingFile = path.join(PENDING_DIR, `${requestId}.json`);

    try {
      if (!fs.existsSync(pendingFile)) {
        vscode.window.showWarningMessage(
          `Request ${requestId?.substring(0, 8) || 'Unknown'}... not found or already completed`,
        );
        return;
      }

      const content = fs.readFileSync(pendingFile, "utf-8");
      const data = JSON.parse(content);

      // 构建 AskRequest 并触发打开命令
      const askRequest = {
        requestId: data.id,
        reason: data.summary || "Reopened request",
        context: data.project,
        model: data.model,
        sessionId: data.sessionId,
        title: data.title,
        options: data.options || [],
      };

      // 使用 VSCode 命令传递请求数据
      vscode.commands.executeCommand("ioUtil.openPanelWithRequest", askRequest);
    } catch (err) {
      vscode.window.showWarningMessage(`Failed to reopen: ${err}`);
    }
  }

  private _getHtmlContent(): string {
    const statusIcon = this._serverRunning ? "verified" : "block";
    const statusText = this._serverRunning ? "Running" : "Stopped";
    const statusClass = this._serverRunning ? "running" : "stopped";

    const sessionsHtml = this._buildSessionsHtml();

    // 生成 CSS URI
    const cssUri = this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "views", "shared", "design-system.css")
    );

    try {
      let template = fs.readFileSync(this._templatePath, "utf-8");
      return template
        .replace(/\{\{STATUS_ICON\}\}/g, statusIcon)
        .replace(/\{\{STATUS_TEXT\}\}/g, statusText)
        .replace(/\{\{STATUS_CLASS\}\}/g, statusClass)
        .replace(/\{\{REQUEST_COUNT\}\}/g, String(this._requestCount))
        .replace(/\{\{PENDING_COUNT\}\}/g, String(this._pendingCount))
        .replace(/\{\{COMPLETED_COUNT\}\}/g, String(this._completedCount))
        .replace(/\{\{SESSIONS_HTML\}\}/g, sessionsHtml)
        .replace(/\{\{CSS_URI\}\}/g, cssUri?.toString() || "");
    } catch {
      return this._getFallbackHtml(statusIcon, statusText);
    }
  }

  private _buildSessionsHtml(): string {
    if (this._pendingRequests.length === 0) {
      return `<div class="empty-state">No requests</div>`;
    }

    return this._pendingRequests
      .map((req) => {
        const shortId = req.id?.substring(0, 8) || 'Unknown';
        const isCompleted = req._completed;
        const statusClass = isCompleted ? "completed" : "pending";
        const statusText = isCompleted ? "done" : "pending";
        const statusIcon = isCompleted ? "check_circle" : "schedule";
        const summarySource =
          req.summary ||
          (req as PendingRequest & { content?: string }).content ||
          "";
        const summary =
          summarySource.length > 56
            ? summarySource.substring(0, 56) + "..."
            : summarySource || "No summary";
        // 项目名称（仅显示最后一个文件夹名）
        const projectPath =
          req.project || (req as PendingRequest & { context?: string }).context || "";
        const projectName = projectPath
          ? projectPath.split(/[/\\]/).pop() || ""
          : "";
        const timeValue =
          (req as PendingRequest & { timestamp?: string }).timestamp ||
          req.createdAt;
        const timeText = this._formatRelativeTime(timeValue);

        // 只有 pending 状态的请求才能重新打开
        const canReopen = !isCompleted;
        return `
        <div class="session-item">
          <div class="session-header">
            <div class="session-id-wrap">
              <span class="session-logo material-symbols-outlined">chat</span>
              <span class="session-id" title="${req.id}">${shortId}...</span>
            </div>
            <span class="session-status ${statusClass}">
              <span class="material-symbols-outlined">${statusIcon}</span>${statusText}
            </span>
          </div>
          <div class="session-meta">
            ${projectName ? `<div class="session-project"><span class="material-symbols-outlined">folder</span>${escapeHtml(projectName)}</div>` : ""}
            <div class="session-time"><span class="material-symbols-outlined">schedule</span>${escapeHtml(timeText)}</div>
          </div>
          <div class="session-reason" title="${escapeHtml(summarySource)}">${escapeHtml(summary)}</div>
          <div class="session-actions">
            ${canReopen ? `<button class="action-btn action-open" onclick="reopenSession('${req.id}')"><span class="material-symbols-outlined">folder_open</span>Open</button>` : ""}
            <button class="action-btn action-delete" onclick="deleteSession('${req.id}')"><span class="material-symbols-outlined">delete</span>Delete</button>
          </div>
        </div>
      `;
      })
      .join("");
  }

  private _getFallbackHtml(icon: string, text: string): string {
    return `<!DOCTYPE html><html><body>
      <p>${icon} ${text}</p>
      <p>Requests: ${this._requestCount}</p>
    </body></html>`;
  }

  private _safeTimeValue(value?: string): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private _formatRelativeTime(value?: string): string {
    const timestamp = this._safeTimeValue(value);
    if (!timestamp) return "unknown";
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 10) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }
}
