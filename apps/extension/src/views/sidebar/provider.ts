import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { PendingRequest } from "../../types";
import { deleteSessionImages } from "../../utils";
import { REQUESTS_DIR } from "../../core/config";

type NodeType = "section" | "status" | "metric" | "action" | "request" | "empty" | "tip";

interface SidebarNode {
  type: NodeType;
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  collapsibleState?: vscode.TreeItemCollapsibleState;
  contextValue?: string;
  command?: vscode.Command;
  iconPath?: vscode.ThemeIcon | vscode.Uri;
}

export class StatusViewProvider implements vscode.TreeDataProvider<SidebarNode> {
  public static readonly viewType = "feedbackLoop.statusView";
  private readonly _isZh = vscode.env.language.toLowerCase().startsWith("zh");

  private _serverRunning = false;
  private _requestCount = 0;
  private _pendingRequests: PendingRequest[] = [];

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<SidebarNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private t(zh: string, en: string): string {
    return this._isZh ? zh : en;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  updateStatus(running: boolean, _port: number): void {
    this._serverRunning = running;
    this.refresh();
  }

  incrementRequestCount(): void {
    this._requestCount++;
    this.fetchRequests();
  }

  refreshSessions(): void {
    this.fetchRequests();
  }

  deleteRequest(requestId: string): void {
    const requestFile = path.join(REQUESTS_DIR, `${requestId}.json`);

    try {
      if (fs.existsSync(requestFile)) {
        fs.unlinkSync(requestFile);
      }
      deleteSessionImages(requestId);
      this.fetchRequests();
    } catch (err) {
      vscode.window.showWarningMessage(this.t(`删除失败: ${err}`, `Delete failed: ${err}`));
    }
  }

  reopenRequest(requestId: string): void {
    const requestFile = path.join(REQUESTS_DIR, `${requestId}.json`);

    try {
      if (!fs.existsSync(requestFile)) {
        vscode.window.showWarningMessage(
          this.t(
            `请求 ${requestId.substring(0, 8)}... 不存在或已处理`,
            `Request ${requestId.substring(0, 8)}... not found or already processed`,
          ),
        );
        return;
      }

      const data = JSON.parse(fs.readFileSync(requestFile, "utf-8"));
      if ((data.status || "pending") !== "pending") {
        vscode.window.showWarningMessage(this.t("该请求已处理", "Request already processed"));
        return;
      }

      const askRequest = {
        requestId: data.id,
        reason: data.summary || this.t("重新打开的请求", "Reopened request"),
        context: data.project,
        model: data.model,
        sessionId: data.sessionId,
        title: data.title,
        options: data.options || [],
      };

      vscode.commands.executeCommand("feedbackLoop.openPanelWithRequest", askRequest);
    } catch (err) {
      vscode.window.showWarningMessage(this.t(`重新打开失败: ${err}`, `Failed to reopen: ${err}`));
    }
  }

  fetchRequests(): void {
    const pendingRequests: PendingRequest[] = [];

    try {
      if (fs.existsSync(REQUESTS_DIR)) {
        const files = fs.readdirSync(REQUESTS_DIR);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const data = JSON.parse(fs.readFileSync(path.join(REQUESTS_DIR, file), "utf-8"));
            if (data.id && (data.status || "pending") === "pending") {
              pendingRequests.push(data);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    this._pendingRequests = [...pendingRequests].sort((a, b) => {
      const aTime = this.safeTimeValue(a.createdAt);
      const bTime = this.safeTimeValue(b.createdAt);
      return bTime - aTime;
    });

    this._requestCount = pendingRequests.length;
    this.refresh();
  }

  getTreeItem(element: SidebarNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.collapsibleState ?? vscode.TreeItemCollapsibleState.None,
    );
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip;
    item.contextValue = element.contextValue;
    item.command = element.command;
    if (element.iconPath) {
      item.iconPath = element.iconPath;
    }
    return item;
  }

  async getChildren(element?: SidebarNode): Promise<SidebarNode[]> {
    if (!element) {
      return [
        {
          type: "section",
          id: "section-service",
          label: this.t("运行状态", "Service Status"),
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          iconPath: new vscode.ThemeIcon("pulse"),
        },
        {
          type: "section",
          id: "section-requests",
          label: this.t(`请求 (${this._requestCount})`, `Requests (${this._requestCount})`),
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          iconPath: new vscode.ThemeIcon("inbox"),
        },
        {
          type: "section",
          id: "section-actions",
          label: this.t("快捷操作", "Quick Actions"),
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          iconPath: new vscode.ThemeIcon("tools"),
        },
      ];
    }

    if (element.id === "section-service") {
      return [
        {
          type: "status",
          id: "status-running",
          label: this._serverRunning ? this.t("运行中", "Running") : this.t("已停止", "Stopped"),
          description: this.t("当前项目监听", "Project listener"),
          iconPath: new vscode.ThemeIcon(
            "circle-filled",
            new vscode.ThemeColor(this._serverRunning ? "terminal.ansiGreen" : "errorForeground"),
          ),
        },
      ];
    }

    if (element.id === "section-actions") {
      return [
        {
          type: "action",
          id: "action-reopen",
          label: this.t("打开最近请求", "Open Latest Request"),
          command: {
            command: "feedbackLoop.openPanel",
            title: this.t("打开最近请求", "Open Latest Request"),
          },
          iconPath: new vscode.ThemeIcon("go-to-file"),
        },
        {
          type: "action",
          id: "action-refresh",
          label: this.t("刷新请求列表", "Refresh Request List"),
          command: {
            command: "feedbackLoop.refreshSessions",
            title: this.t("刷新请求列表", "Refresh Request List"),
          },
          iconPath: new vscode.ThemeIcon("refresh"),
        },
        {
          type: "action",
          id: "action-restart",
          label: this.t("重启服务", "Restart Service"),
          command: {
            command: "feedbackLoop.restart",
            title: this.t("重启服务", "Restart Service"),
          },
          iconPath: new vscode.ThemeIcon("debug-restart"),
        },
        {
          type: "tip",
          id: "tip",
          label: this.t(
            "提示: 在当前项目目录运行 feedback CLI 即可触发请求。",
            "Tip: Run feedback CLI in this project to trigger requests.",
          ),
          iconPath: new vscode.ThemeIcon("lightbulb"),
        },
      ];
    }

    if (element.id === "section-requests") {
      if (this._pendingRequests.length === 0) {
        return [
          {
            type: "empty",
            id: "requests-empty",
            label: this.t("当前没有待处理请求", "No requests"),
            description: this.t("运行 feedback CLI 后会出现在这里", "Run feedback CLI and requests will appear here"),
            iconPath: new vscode.ThemeIcon("inbox"),
          },
        ];
      }

      return this._pendingRequests.slice(0, 50).map((req) => {
        const shortId = req.id?.substring(0, 8) || "Unknown";
        const summarySource = req.summary || "";
        const summary =
          summarySource.length > 72
            ? `${summarySource.substring(0, 72)}...`
            : summarySource || this.t("无摘要", "No summary");
        const timeText = this.formatRelativeTime(req.createdAt);
        const projectPath = req.project || "";
        const projectName = projectPath ? projectPath.split(/[\\/]/).pop() || "" : "";

        return {
          type: "request",
          id: `request-${req.id}`,
          label: `${shortId}...`,
          description: `${this.t("待处理", "pending")} • ${timeText}`,
          tooltip: `${summary}\n${projectName ? `${this.t("项目", "Project")}: ${projectName}` : ""}`,
          contextValue: "requestPending",
          command: {
            command: "feedbackLoop.reopenRequest",
            title: this.t("重新打开请求", "Reopen Request"),
            arguments: [req.id],
          },
          iconPath: new vscode.ThemeIcon("clock", new vscode.ThemeColor("descriptionForeground")),
        };
      });
    }

    return [];
  }

  private safeTimeValue(value?: string): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private formatRelativeTime(value?: string): string {
    const timestamp = this.safeTimeValue(value);
    if (!timestamp) return this.t("未知", "unknown");
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 10) return this.t("刚刚", "just now");
    if (diffSec < 60) return this.t(`${diffSec}秒前`, `${diffSec}s ago`);
    if (diffSec < 3600) {
      const m = Math.floor(diffSec / 60);
      return this.t(`${m}分钟前`, `${m}m ago`);
    }
    if (diffSec < 86400) {
      const h = Math.floor(diffSec / 3600);
      return this.t(`${h}小时前`, `${h}h ago`);
    }
    const d = Math.floor(diffSec / 86400);
    return this.t(`${d}天前`, `${d}d ago`);
  }
}
