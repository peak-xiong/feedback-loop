/**
 * Session Checkpoint Dialog Handler
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { AskRequest } from "../../types";
import { escapeHtml, saveBase64Image } from "../../utils";
import { REQUEST_TIMEOUT } from "../../core/config";
import { submitFeedback } from "../../polling";

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
  extensionUri: vscode.Uri,
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
      },
    );

    panel.webview.html = getWebviewContent(request, extensionUri, panel.webview);
  } catch (err) {
    console.error("Failed to create webview panel:", err);
    setLastPendingRequest(null);
    try {
      await submitFeedback(request.requestId, "[cancelled]");
    } catch {
      // Ignore send errors
    }
    vscode.window.showErrorMessage(
      `Session Helper: Failed to create panel - ${err instanceof Error ? err.message : "Unknown error"}`,
    );
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

            // 处理图片：如果有 base64 数据，保存为文件并替换
            let finalText = message.text || "";
            if (message.imageBase64) {
              const imagePath = saveBase64Image(
                request.requestId,
                message.imageBase64,
              );
              if (imagePath) {
                // 替换 base64 为文件路径
                finalText = finalText.replace(
                  /\[图片已附加\][\s\S]*$/,
                  `[图片已附加]\n${imagePath}`,
                );
              }
            }

            await submitFeedback(request.requestId, finalText, [], {
              model: request.model,
              sessionId: request.sessionId,
              title: request.title,
              agentId: request.agentId,
            });
            panel.dispose();
          } catch (error) {
            responseSent = false;
            panel.webview.postMessage({
              command: "sendFailed",
              error: error instanceof Error ? error.message : "Unknown error",
            });
            vscode.window.showErrorMessage(
              `Failed to send response: ${error instanceof Error ? error.message : "Unknown error"}. You can try again.`,
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
            panel.webview.postMessage({
              command: "sendFailed",
              error: error instanceof Error ? error.message : "Unknown error",
            });
            vscode.window.showErrorMessage(
              `Failed to send response: ${error instanceof Error ? error.message : "Unknown error"}. You can try again.`,
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
    [],
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

function getWebviewContent(
  request: AskRequest,
  extensionUri: vscode.Uri,
  webview: vscode.Webview,
): string {
  // 生成 CSS URI
  const cssUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "views", "shared", "design-system.css")
  );
  const templatePath = path.join(
    extensionUri.fsPath,
    "dist",
    "views",
    "dialog",
    "checkpoint.html",
  );
  const options = request.options || [];

  const optionsHtml =
    options.length > 0
      ? `
    <div class="options-section">
      <div class="options-label">Quick options:</div>
      <div class="options-buttons">
        ${options.map((opt) => `<button class="option-btn" data-option="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join("")}
      </div>
    </div>
  `
      : "";

  // 生成元信息 HTML（使用 meta-pill 样式）
  const metaParts: string[] = [];
  // 项目名称（仅显示最后一个文件夹名）
  if (request.context) {
    const projectName = request.context.split(/[/\\]/).pop() || request.context;
    metaParts.push(
      `<span class="meta-pill"><span class="material-symbols-outlined" style="font-size:14px">folder</span> <span class="meta-val">${escapeHtml(projectName)}</span></span>`,
    );
  }
  if (request.model) {
    metaParts.push(
      `<span class="meta-pill">Model <span class="meta-val">${escapeHtml(request.model)}</span></span>`,
    );
  }
  if (request.title) {
    metaParts.push(
      `<span class="meta-pill">Title <span class="meta-val green">${escapeHtml(request.title)}</span></span>`,
    );
  }
  if (request.agentId) {
    metaParts.push(
      `<span class="meta-pill">Agent <span class="meta-val">${escapeHtml(request.agentId)}</span></span>`,
    );
  }
  const metaInfoHtml = metaParts.length > 0 ? metaParts.join("") : "";

  const headerTitle = request.title || "Session Checkpoint";
  const headerContextHtml = request.context
    ? `<div class="header-context"><span class="material-symbols-outlined" style="font-size:14px">push_pin</span> ${escapeHtml(request.context)}</div>`
    : "";

  try {
    let template = fs.readFileSync(templatePath, "utf-8");
    return template
      .replace(/\{\{REASON\}\}/g, escapeHtml(request.reason))
      .replace(/\{\{REQUEST_ID\}\}/g, escapeHtml(request.requestId))
      .replace(/\{\{OPTIONS_HTML\}\}/g, optionsHtml)
      .replace(/\{\{META_INFO_HTML\}\}/g, metaInfoHtml)
      .replace(/\{\{HEADER_TITLE\}\}/g, headerTitle)
      .replace(/\{\{HEADER_CONTEXT_HTML\}\}/g, headerContextHtml)
      .replace(/\{\{CSS_URI\}\}/g, cssUri.toString());
  } catch {
    // Fallback inline template
    return `<!DOCTYPE html><html><body>
      <h1>Session Checkpoint</h1>
      <p>${escapeHtml(request.reason)}</p>
      <p>Request ID: ${escapeHtml(request.requestId)}</p>
    </body></html>`;
  }
}
