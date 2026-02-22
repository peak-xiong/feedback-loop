import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { PendingRequest } from "../../types";
import { deleteSessionImages } from "../../utils";
import { PENDING_DIR, COMPLETED_DIR } from "../../core/config";

type NodeType =
  | "section"
  | "status"
  | "metric"
  | "action"
  | "request"
  | "empty"
  | "tip";

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

interface CompletedRequest {
  id: string;
  content?: string;
  timestamp?: string;
  model?: string;
  sessionId?: string;
  title?: string;
  agentId?: string;
}

export class StatusViewProvider
  implements vscode.TreeDataProvider<SidebarNode>
{
  public static readonly viewType = "feedbackLoop.statusView";
  private readonly _isZh = vscode.env.language.toLowerCase().startsWith("zh");

  private _serverRunning = false;
  private _requestCount = 0;
  private _pendingCount = 0;
  private _completedCount = 0;
  private _pendingRequests: PendingRequest[] = [];
  private _completedRequests: CompletedRequest[] = [];

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    SidebarNode | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {}

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
    const pendingFile = path.join(PENDING_DIR, `${requestId}.json`);
    const completedFile = path.join(COMPLETED_DIR, `${requestId}.json`);

    try {
      if (fs.existsSync(pendingFile)) {
        fs.unlinkSync(pendingFile);
      }
      if (fs.existsSync(completedFile)) {
        fs.unlinkSync(completedFile);
      }
      deleteSessionImages(requestId);
      this.fetchRequests();
    } catch (err) {
      vscode.window.showWarningMessage(
        this.t(`删除失败: ${err}`, `Delete failed: ${err}`),
      );
    }
  }

  reopenRequest(requestId: string): void {
    const pendingFile = path.join(PENDING_DIR, `${requestId}.json`);

    try {
      if (!fs.existsSync(pendingFile)) {
        vscode.window.showWarningMessage(
          this.t(
            `请求 ${requestId.substring(0, 8)}... 不存在或已完成`,
            `Request ${requestId.substring(0, 8)}... not found or already completed`,
          ),
        );
        return;
      }

      const content = fs.readFileSync(pendingFile, "utf-8");
      const data = JSON.parse(content);

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
      vscode.window.showWarningMessage(
        this.t(`重新打开失败: ${err}`, `Failed to reopen: ${err}`),
      );
    }
  }

  fetchRequests(): void {
    const pendingRequests: PendingRequest[] = [];
    const completedRequests: CompletedRequest[] = [];

    try {
      if (fs.existsSync(PENDING_DIR)) {
        const files = fs.readdirSync(PENDING_DIR);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const data = JSON.parse(
              fs.readFileSync(path.join(PENDING_DIR, file), "utf-8"),
            );
            if (data.id) pendingRequests.push(data);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }

    try {
      if (fs.existsSync(COMPLETED_DIR)) {
        const files = fs
          .readdirSync(COMPLETED_DIR)
          .filter((f) => f.endsWith(".json"))
          .slice(0, 20);
        for (const file of files) {
          try {
            const data = JSON.parse(
              fs.readFileSync(path.join(COMPLETED_DIR, file), "utf-8"),
            );
            if (typeof data.requestId === "string" && data.requestId) {
              completedRequests.push({
                id: data.requestId,
                content: data.content,
                timestamp: data.timestamp,
                model: data.model,
                sessionId: data.sessionId,
                title: data.title,
                agentId: data.agentId,
              });
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
    this._completedRequests = [...completedRequests].sort((a, b) => {
      const aTime = this.safeTimeValue(a.timestamp);
      const bTime = this.safeTimeValue(b.timestamp);
      return bTime - aTime;
    });

    this._pendingCount = pendingRequests.length;
    this._completedCount = completedRequests.length;
    this._requestCount = this._pendingCount + this._completedCount;
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
          id: "section-pending",
          label: this.t(
            `待处理请求 (${this._pendingCount})`,
            `Pending Requests (${this._pendingCount})`,
          ),
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          iconPath: new vscode.ThemeIcon("inbox"),
        },
        {
          type: "section",
          id: "section-completed",
          label: this.t(
            `已完成请求 (${this._completedCount})`,
            `Completed Requests (${this._completedCount})`,
          ),
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          iconPath: new vscode.ThemeIcon("history"),
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
          label: this._serverRunning
            ? this.t("运行中", "Running")
            : this.t("已停止", "Stopped"),
          description: this.t("当前项目监听", "Project listener"),
          iconPath: new vscode.ThemeIcon(
            "circle-filled",
            new vscode.ThemeColor(
              this._serverRunning ? "terminal.ansiGreen" : "errorForeground",
            ),
          ),
        },
        {
          type: "metric",
          id: "metric-overview",
          label: this.t(`总计: ${this._requestCount}`, `Total: ${this._requestCount}`),
          description: this.t(
            `待处理 ${this._pendingCount} | 已完成 ${this._completedCount}`,
            `Pending ${this._pendingCount} | Done ${this._completedCount}`,
          ),
          iconPath: new vscode.ThemeIcon("list-unordered"),
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

    if (element.id === "section-pending") {
      if (this._pendingRequests.length === 0) {
        return [
          {
            type: "empty",
            id: "pending-empty",
            label: this.t("当前没有待处理请求", "No pending requests"),
            description: this.t(
              "运行 feedback CLI 后会出现在这里",
              "Run feedback CLI and requests will appear here",
            ),
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
        const timeValue = req.createdAt;
        const timeText = this.formatRelativeTime(timeValue);
        const projectPath = req.project || "";
        const projectName = projectPath
          ? projectPath.split(/[/\\]/).pop() || ""
          : "";

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
          iconPath: new vscode.ThemeIcon(
            "clock",
            new vscode.ThemeColor("descriptionForeground"),
          ),
        };
      });
    }

    if (element.id === "section-completed") {
      if (this._completedRequests.length === 0) {
        return [
          {
            type: "empty",
            id: "completed-empty",
            label: this.t("当前没有已完成请求", "No completed requests"),
            description: this.t(
              "处理完成后会出现在这里",
              "Completed requests will appear here",
            ),
            iconPath: new vscode.ThemeIcon("history"),
          },
        ];
      }

      return this._completedRequests.slice(0, 50).map((req) => {
        const shortId = req.id?.substring(0, 8) || "Unknown";
        const summarySource = req.content || "";
        const summary =
          summarySource.length > 72
            ? `${summarySource.substring(0, 72)}...`
            : summarySource || this.t("无摘要", "No summary");
        const timeValue = req.timestamp;
        const timeText = this.formatRelativeTime(timeValue);

        return {
          type: "request",
          id: `request-${req.id}`,
          label: `${shortId}...`,
          description: `${this.t("已完成", "done")} • ${timeText}`,
          tooltip: summary,
          contextValue: "requestCompleted",
          iconPath: new vscode.ThemeIcon(
            "pass-filled",
            new vscode.ThemeColor("terminal.ansiGreen"),
          ),
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
