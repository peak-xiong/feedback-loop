/**
 * Session Helper Extension - Entry Point
 */
import * as vscode from "vscode";
import { DEFAULT_PORT } from "./config";
import { StatusViewProvider } from "../views/sidebar/provider";
import { startServer, stopServer, isServerRunning, cleanupOldMcpProcesses } from "../server";
import { showSessionCheckpointDialog, getLastPendingRequest } from "../views/dialog/handler";
import { AskRequest } from "../types";

let statusBarItem: vscode.StatusBarItem;
let statusViewProvider: StatusViewProvider;
let currentPort: number = DEFAULT_PORT;
let extensionUri: vscode.Uri;

function updateStatusBar(running: boolean, port?: number): void {
  if (running && port) {
    currentPort = port;
    statusBarItem.text = `$(check) TS: ${port}`;
    statusBarItem.tooltip = `Tool Sync running (port ${port})`;
    statusBarItem.backgroundColor = undefined;
    statusViewProvider?.updateStatus(true, port);
  } else {
    statusBarItem.text = "$(x) TS: Stopped";
    statusBarItem.tooltip = "Tool Sync not running";
    statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    statusViewProvider?.updateStatus(false, port || DEFAULT_PORT);
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
  const port = config.get<number>("serverPort", DEFAULT_PORT);
  const autoStart = config.get<boolean>("autoStart", true);

  context.subscriptions.push(
    vscode.commands.registerCommand("ioUtil.showStatus", () => {
      vscode.window.showInformationMessage(
        `Session Helper: ${isServerRunning() ? `Running (port ${currentPort})` : "Stopped"}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ioUtil.restart", () => {
      const port = vscode.workspace.getConfiguration("ioUtil").get<number>("serverPort", DEFAULT_PORT);
      startServer(port, handleRequest, updateStatusBar);
      vscode.window.showInformationMessage(`Session Helper restarted (port ${port})`);
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

  cleanupOldMcpProcesses().then(() => console.log("Old processes cleanup completed"));

  if (autoStart) {
    startServer(port, handleRequest, updateStatusBar);
  } else {
    updateStatusBar(false);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("ioUtil.serverPort")) {
        const newPort = vscode.workspace.getConfiguration("ioUtil").get<number>("serverPort", DEFAULT_PORT);
        startServer(newPort, handleRequest, updateStatusBar);
      }
    })
  );
}

export function deactivate(): void {
  stopServer();
}
