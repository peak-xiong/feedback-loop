/**
 * Session Checkpoint Dialog Handler
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { AskRequest } from "../../types";
import { escapeHtml } from "../../utils";
import { REQUEST_TIMEOUT } from "../../core/config";
import { submitFeedback } from "../../server";

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
      await submitFeedback(request.requestId, "[cancelled]");
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
            
            await submitFeedback(request.requestId, message.text, [], {
              model: request.model,
              sessionId: request.sessionId,
              title: request.title,
              agentId: request.agentId,
            });
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
            await submitFeedback(request.requestId, "[end]");
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
            await submitFeedback(request.requestId, "[cancelled]");
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
      await submitFeedback(request.requestId, "[cancelled]");
    } catch {
      // Ignore errors on dispose
    }
  });
}

function getWebviewContent(request: AskRequest, extensionUri: vscode.Uri): string {
  const templatePath = path.join(extensionUri.fsPath, "dist", "views", "dialog", "checkpoint.html");
  const options = request.options || [];
  
  const optionsHtml = options.length > 0 ? `
    <div class="options-section">
      <div class="options-label">Quick options:</div>
      <div class="options-buttons">
        ${options.map((opt) => `<button class="option-btn" data-option="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
      </div>
    </div>
  ` : '';

  // 生成元信息 HTML
  const metaParts: string[] = [];
  if (request.model) {
    metaParts.push(`<span style="display: flex; gap: 5px;"><span class="request-id-label">Model:</span><span style="color: var(--vscode-textLink-foreground, #3794ff);">${escapeHtml(request.model)}</span></span>`);
  }
  if (request.title) {
    metaParts.push(`<span style="display: flex; gap: 5px;"><span class="request-id-label">Title:</span><span style="color: var(--vscode-charts-green, #89d185);">${escapeHtml(request.title)}</span></span>`);
  }
  if (request.agentId) {
    metaParts.push(`<span style="display: flex; gap: 5px;"><span class="request-id-label">Agent:</span><span style="color: var(--vscode-textLink-foreground, #3794ff); word-break: break-all;">${escapeHtml(request.agentId)}</span></span>`);
  }
  const metaInfoHtml = metaParts.length > 0 
    ? metaParts.join('<span style="margin: 0 8px; color: #555;">|</span>')
    : '<span style="color: var(--vscode-descriptionForeground, #888);">No metadata provided</span>';

  const headerTitle = request.title || "Session Checkpoint";
  const headerContextHtml = request.context 
    ? `<div class="header-context">📌 ${escapeHtml(request.context)}</div>` 
    : '';

  try {
    let template = fs.readFileSync(templatePath, "utf-8");
    return template
      .replace(/\{\{REASON\}\}/g, escapeHtml(request.reason))
      .replace(/\{\{REQUEST_ID\}\}/g, escapeHtml(request.requestId))
      .replace(/\{\{OPTIONS_HTML\}\}/g, optionsHtml)
      .replace(/\{\{META_INFO_HTML\}\}/g, metaInfoHtml)
      .replace(/\{\{HEADER_TITLE\}\}/g, headerTitle)
      .replace(/\{\{HEADER_CONTEXT_HTML\}\}/g, headerContextHtml);
  } catch {
    // Fallback inline template
    return `<!DOCTYPE html><html><body>
      <h1>Session Checkpoint</h1>
      <p>${escapeHtml(request.reason)}</p>
      <p>Request ID: ${escapeHtml(request.requestId)}</p>
    </body></html>`;
  }
}
