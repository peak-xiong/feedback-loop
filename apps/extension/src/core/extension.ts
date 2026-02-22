/**
 * Feedback Loop Extension - Entry Point
 */
import * as vscode from "vscode";
import * as path from "path";
import { StatusViewProvider } from "../views/sidebar/provider";
import { startServer, stopServer, isServerRunning } from "../polling";
import {
  showSessionCheckpointDialog,
  getLastPendingRequest,
} from "../views/dialog/handler";
import { AskRequest, PendingRequest } from "../types";

let statusBarItem: vscode.StatusBarItem;
let statusViewProvider: StatusViewProvider;
let extensionUri: vscode.Uri;

function normalizeFsPath(input: string): string {
  return path
    .resolve(input)
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function shouldHandleRequestInCurrentWindow(request: PendingRequest): boolean {
  // 只在当前聚焦窗口处理，避免后台窗口抢占弹窗
  if (!vscode.window.state.focused) {
    return false;
  }

  const requestProject = request.project?.trim();
  if (!requestProject) {
    return false;
  }

  const normalizedRequestProject = normalizeFsPath(requestProject);
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  if (workspaceFolders.length === 0) {
    return false;
  }

  const workspaceRoots = workspaceFolders.map((folder) =>
    normalizeFsPath(folder.uri.fsPath),
  );

  return workspaceRoots.some(
    (root) =>
      normalizedRequestProject === root ||
      normalizedRequestProject.startsWith(`${root}/`) ||
      root.startsWith(`${normalizedRequestProject}/`),
  );
}

function updateStatusBar(running: boolean, _port?: number): void {
  if (running) {
    statusBarItem.text = "$(check) Loop";
    statusBarItem.tooltip = "Feedback Loop: 监听中";
    statusBarItem.backgroundColor = undefined;
    statusViewProvider?.updateStatus(true, 0);
  } else {
    statusBarItem.text = "$(x) Loop";
    statusBarItem.tooltip = "Feedback Loop: 已停止";
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
    statusViewProvider?.updateStatus(false, 0);
  }
}

async function handleRequest(request: AskRequest): Promise<void> {
  await showSessionCheckpointDialog(request, extensionUri);
  statusViewProvider?.incrementRequestCount();
}

export function activate(context: vscode.ExtensionContext): void {
  console.log("Feedback Loop extension is now active");
  extensionUri = context.extensionUri;

  statusViewProvider = new StatusViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      StatusViewProvider.viewType,
      statusViewProvider,
    ),
  );

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "ioUtil.showStatus";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const config = vscode.workspace.getConfiguration("ioUtil");
  const autoStart = config.get<boolean>("autoStart", true);

  context.subscriptions.push(
    vscode.commands.registerCommand("ioUtil.showStatus", () => {
      vscode.window.showInformationMessage(
        `Feedback Loop: ${isServerRunning() ? "Polling active" : "Stopped"}`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ioUtil.restart", () => {
      startServer(
        handleRequest,
        updateStatusBar,
        1000,
        shouldHandleRequestInCurrentWindow,
      );
      vscode.window.showInformationMessage(`Feedback Loop restarted`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ioUtil.openPanel", () => {
      const pendingRequest = getLastPendingRequest();
      if (pendingRequest) {
        showSessionCheckpointDialog(pendingRequest, extensionUri);
      } else {
        vscode.window.showInformationMessage(
          "Feedback Loop: No pending requests",
        );
      }
    }),
  );

  // 用于从 Sessions 列表重新打开特定请求
  context.subscriptions.push(
    vscode.commands.registerCommand("ioUtil.openPanelWithRequest", (request: AskRequest) => {
      if (request) {
        showSessionCheckpointDialog(request, extensionUri);
      }
    }),
  );

  if (autoStart) {
    startServer(
      handleRequest,
      updateStatusBar,
      1000,
      shouldHandleRequestInCurrentWindow,
    );
  } else {
    updateStatusBar(false);
  }
}

export function deactivate(): void {
  stopServer();
}
