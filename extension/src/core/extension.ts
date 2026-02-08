/**
 * Session Helper Extension - Entry Point
 */
import * as vscode from "vscode";
import { StatusViewProvider } from "../views/sidebar/provider";
import { startServer, stopServer, isServerRunning } from "../server";
import { showSessionCheckpointDialog, getLastPendingRequest } from "../views/dialog/handler";
import { AskRequest } from "../types";

let statusBarItem: vscode.StatusBarItem;
let statusViewProvider: StatusViewProvider;
let extensionUri: vscode.Uri;

// API 服务器端口
const API_PORT = 3000;

function updateStatusBar(running: boolean, port?: number): void {
  if (running) {
    statusBarItem.text = "$(check) IO";
    statusBarItem.tooltip = "IO Util: 监听中";
    statusBarItem.backgroundColor = undefined;
    statusViewProvider?.updateStatus(true, 0);
  } else {
    statusBarItem.text = "$(x) IO";
    statusBarItem.tooltip = "IO Util: 已停止";
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    statusViewProvider?.updateStatus(false, 0);
  }
}

async function handleRequest(request: AskRequest): Promise<void> {
  await showSessionCheckpointDialog(request, extensionUri);
  statusViewProvider?.incrementRequestCount();
}

export function activate(context: vscode.ExtensionContext): void {
  console.log("Session Helper extension is now active");
  extensionUri = context.extensionUri;

  statusViewProvider = new StatusViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(StatusViewProvider.viewType, statusViewProvider)
  );

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "ioUtil.showStatus";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const config = vscode.workspace.getConfiguration("ioUtil");
  const autoStart = config.get<boolean>("autoStart", true);

  context.subscriptions.push(
    vscode.commands.registerCommand("ioUtil.showStatus", () => {
      vscode.window.showInformationMessage(
        `Session Helper: ${isServerRunning() ? `Polling active (API port ${API_PORT})` : "Stopped"}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ioUtil.restart", () => {
      startServer(handleRequest, updateStatusBar);
      vscode.window.showInformationMessage(`Session Helper restarted`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ioUtil.openPanel", () => {
      const pendingRequest = getLastPendingRequest();
      if (pendingRequest) {
        showSessionCheckpointDialog(pendingRequest, extensionUri);
      } else {
        vscode.window.showInformationMessage("Session Helper: No pending requests");
      }
    })
  );

  if (autoStart) {
    startServer(handleRequest, updateStatusBar);
  } else {
    updateStatusBar(false);
  }
}

export function deactivate(): void {
  stopServer();
}

