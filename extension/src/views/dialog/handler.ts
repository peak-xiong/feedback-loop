/**
 * Session Checkpoint Dialog Handler
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { AskRequest } from "../../types";
import { escapeHtml } from "../../utils";
import { MCP_CALLBACK_PORT, REQUEST_TIMEOUT } from "../../core/config";
import { sendResponseToMCP } from "../../server";

let lastPendingRequest: AskRequest | null = null;
let lastPendingRequestTime: number = 0;

export function setLastPendingRequest(request: AskRequest | null): void {
  lastPendingRequest = request;
  lastPendingRequestTime = request ? Date.now() : 0;
}

export function getLastPendingRequest(): AskRequest | null {
  if (!lastPendingRequest) return null;
  if (Date.now() - lastPendingRequestTime > REQUEST_TIMEOUT) {
    lastPendingRequest = null;
    return null;
  }
  return lastPendingRequest;
}

/**
 * Show the Session Checkpoint dialog
 */
export async function showSessionCheckpointDialog(
  request: AskRequest,
  extensionUri: vscode.Uri
): Promise<void> {
  setLastPendingRequest(request);
  
  let panel: vscode.WebviewPanel;
  try {
    panel = vscode.window.createWebviewPanel(
      "ioUtil",
      "Session Checkpoint",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = getWebviewContent(request, extensionUri);
  } catch (err) {
    console.error("Failed to create webview panel:", err);
    setLastPendingRequest(null);
    try {
      await sendResponseToMCP(request.requestId, "", true, request.callbackPort || MCP_CALLBACK_PORT);
    } catch {
      // Ignore send errors
    }
    vscode.window.showErrorMessage(`Session Helper: Failed to create panel - ${err instanceof Error ? err.message : "Unknown error"}`);
    return;
  }

  let responseSent = false;

  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (responseSent) return;
      
      switch (message.command) {
        case "continue":
          try {
            responseSent = true;
            setLastPendingRequest(null);
            await sendResponseToMCP(request.requestId, message.text, false, request.callbackPort || MCP_CALLBACK_PORT);
            panel.dispose();
          } catch (error) {
            responseSent = false;
            panel.webview.postMessage({ command: 'sendFailed', error: error instanceof Error ? error.message : "Unknown error" });
            vscode.window.showErrorMessage(
              `Failed to send response: ${error instanceof Error ? error.message : "Unknown error"}. You can try again.`
            );
          }
          break;
        case "end":
          try {
            responseSent = true;
            await sendResponseToMCP(request.requestId, "", false, request.callbackPort || MCP_CALLBACK_PORT);
            panel.dispose();
          } catch (error) {
            responseSent = false;
            panel.webview.postMessage({ command: 'sendFailed', error: error instanceof Error ? error.message : "Unknown error" });
            vscode.window.showErrorMessage(
              `Failed to send response: ${error instanceof Error ? error.message : "Unknown error"}. You can try again.`
            );
          }
          break;
        case "cancel":
          try {
            responseSent = true;
            await sendResponseToMCP(request.requestId, "", true, request.callbackPort || MCP_CALLBACK_PORT);
            panel.dispose();
          } catch {
            // Ignore errors on cancel
          }
          break;
      }
    },
    undefined,
    []
  );

  panel.onDidDispose(async () => {
    if (lastPendingRequest?.requestId === request.requestId) {
      setLastPendingRequest(null);
    }
    if (responseSent) return;
    try {
      await sendResponseToMCP(request.requestId, "", true, request.callbackPort || MCP_CALLBACK_PORT);
    } catch {
      // Ignore errors on dispose
    }
  });
}

function getWebviewContent(request: AskRequest, extensionUri: vscode.Uri): string {
  const templatePath = path.join(extensionUri.fsPath, "src", "views", "dialog", "checkpoint.html");
  const options = request.options || [];
  
  const optionsHtml = options.length > 0 ? `
    <div class="options-section">
      <div class="options-label">Quick options:</div>
      <div class="options-buttons">
        ${options.map((opt) => `<button class="option-btn" data-option="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
      </div>
    </div>
  ` : '';

  try {
    let template = fs.readFileSync(templatePath, "utf-8");
    return template
      .replace(/\{\{REASON\}\}/g, escapeHtml(request.reason))
      .replace(/\{\{REQUEST_ID\}\}/g, escapeHtml(request.requestId))
      .replace(/\{\{OPTIONS_HTML\}\}/g, optionsHtml);
  } catch {
    // Fallback inline template
    return `<!DOCTYPE html><html><body>
      <h1>Session Checkpoint</h1>
      <p>${escapeHtml(request.reason)}</p>
      <p>Request ID: ${escapeHtml(request.requestId)}</p>
    </body></html>`;
  }
}
