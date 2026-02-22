/**
 * Feedback Loop Extension - Entry Point
 */
import * as vscode from "vscode";
import { StatusViewProvider } from "../views/sidebar/provider";
import { startServer, stopServer, isServerRunning } from "../polling";
import { getPrimaryWorkspaceRoot, setProjectRoot } from "./config";
import { ensureGitignore } from "../utils/gitignore";
import {
  showSessionInboxDialog,
  getLastPendingRequest,
} from "../views/dialog/handler";
import { AskRequest } from "../types";

let statusBarItem: vscode.StatusBarItem;
let statusViewProvider: StatusViewProvider;
let extensionUri: vscode.Uri;
const isZh = vscode.env.language.toLowerCase().startsWith("zh");

function t(zh: string, en: string): string {
  return isZh ? zh : en;
}

function extractRequestId(input: unknown): string | null {
  if (typeof input === "string" && input.trim()) {
    return input.trim();
  }
  if (
    input &&
    typeof input === "object" &&
    "id" in input &&
    typeof (input as { id?: unknown }).id === "string"
  ) {
    const rawId = ((input as { id: string }).id || "").trim();
    if (rawId.startsWith("request-")) {
      return rawId.slice("request-".length);
    }
    return rawId || null;
  }
  return null;
}

function updateStatusBar(running: boolean, _port?: number): void {
  if (running) {
    statusBarItem.text = "$(check) Loop";
    statusBarItem.tooltip = t("Feedback Loop: 监听中", "Feedback Loop: Running");
    statusBarItem.backgroundColor = undefined;
    statusViewProvider?.updateStatus(true, 0);
  } else {
    statusBarItem.text = "$(x) Loop";
    statusBarItem.tooltip = t("Feedback Loop: 已停止", "Feedback Loop: Stopped");
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
    statusViewProvider?.updateStatus(false, 0);
  }
}

async function handleRequest(request: AskRequest): Promise<void> {
  await showSessionInboxDialog(request, extensionUri);
  statusViewProvider?.incrementRequestCount();
}

export function activate(context: vscode.ExtensionContext): void {
  console.log("Feedback Loop extension is now active");
  extensionUri = context.extensionUri;
  const workspaceRoot = getPrimaryWorkspaceRoot();
  if (workspaceRoot) {
    setProjectRoot(workspaceRoot);
    ensureGitignore(workspaceRoot).catch(() => {});
  }

  statusViewProvider = new StatusViewProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      StatusViewProvider.viewType,
      statusViewProvider,
    ),
  );
  statusViewProvider.refreshSessions();

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "feedbackLoop.showStatus";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const config = vscode.workspace.getConfiguration("feedbackLoop");
  const autoStart = config.get<boolean>("autoStart", true);

  context.subscriptions.push(
    vscode.commands.registerCommand("feedbackLoop.showStatus", () => {
      vscode.window.showInformationMessage(
        isServerRunning()
          ? t("Feedback Loop: 监听中", "Feedback Loop: Polling active")
          : t("Feedback Loop: 已停止", "Feedback Loop: Stopped"),
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("feedbackLoop.restart", () => {
      const currentWorkspaceRoot = getPrimaryWorkspaceRoot();
      if (!currentWorkspaceRoot) {
        vscode.window.showWarningMessage(
          t(
            "Feedback Loop: 请先打开项目目录再启动。",
            "Feedback Loop: Open a project folder first.",
          ),
        );
        return;
      }
      setProjectRoot(currentWorkspaceRoot);
      startServer(handleRequest, updateStatusBar, 1000);
      statusViewProvider.refreshSessions();
      vscode.window.showInformationMessage(
        t("Feedback Loop: 已重启", "Feedback Loop restarted"),
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("feedbackLoop.refreshSessions", () => {
      statusViewProvider.refreshSessions();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("feedbackLoop.reopenRequest", (arg: unknown) => {
      const requestId = extractRequestId(arg);
      if (!requestId) return;
      statusViewProvider.reopenRequest(requestId);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("feedbackLoop.deleteRequest", (arg: unknown) => {
      const requestId = extractRequestId(arg);
      if (!requestId) return;
      statusViewProvider.deleteRequest(requestId);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("feedbackLoop.openPanel", () => {
      const pendingRequest = getLastPendingRequest();
      if (pendingRequest) {
        showSessionInboxDialog(pendingRequest, extensionUri);
      } else {
        vscode.window.showInformationMessage(
          t(
            "Feedback Loop: 当前没有待处理请求",
            "Feedback Loop: No pending requests",
          ),
        );
      }
    }),
  );

  // 用于从 Sessions 列表重新打开特定请求
  context.subscriptions.push(
    vscode.commands.registerCommand("feedbackLoop.openPanelWithRequest", (request: AskRequest) => {
      if (request) {
        showSessionInboxDialog(request, extensionUri);
      }
    }),
  );

  if (autoStart) {
    if (!workspaceRoot) {
      updateStatusBar(false);
      vscode.window.showWarningMessage(
        t(
          "Feedback Loop: 当前窗口未打开项目目录，未启动监听。",
          "Feedback Loop: No project folder opened, listener not started.",
        ),
      );
      return;
    }
    setProjectRoot(workspaceRoot);
    startServer(handleRequest, updateStatusBar, 1000);
    statusViewProvider.refreshSessions();
  } else {
    updateStatusBar(false);
  }
}

export function deactivate(): void {
  stopServer();
}
