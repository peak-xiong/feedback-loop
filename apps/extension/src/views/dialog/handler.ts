/**
 * Feedback dialog handler
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { AskRequest } from "../../types";
import { escapeHtml, saveBase64Image } from "../../utils";
import { REQUESTS_DIR, REQUEST_TIMEOUT } from "../../core/config";
import { submitFeedback } from "../../polling";

let lastPendingRequest: AskRequest | null = null;
let lastPendingRequestTime: number = 0;
const isZh = vscode.env.language.toLowerCase().startsWith("zh");

function t(zh: string, en: string): string {
  return isZh ? zh : en;
}

function hasRequestLeftPending(requestId: string): boolean {
  if (!requestId || !REQUESTS_DIR) {
    return false;
  }

  const requestFile = path.join(REQUESTS_DIR, `${requestId}.json`);
  if (!fs.existsSync(requestFile)) {
    return true;
  }
  try {
    const data = JSON.parse(fs.readFileSync(requestFile, "utf-8"));
    return (data.status || "pending") !== "pending";
  } catch {
    return false;
  }
}

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
 * Show feedback inbox dialog
 */
export async function showSessionInboxDialog(
  request: AskRequest,
  extensionUri: vscode.Uri,
): Promise<void> {
  setLastPendingRequest(request);

  let panel: vscode.WebviewPanel;
  try {
    panel = vscode.window.createWebviewPanel(
      "feedbackLoop",
      t("Feedback Loop 收件箱", "Feedback Loop Inbox"),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );
    panel.iconPath = vscode.Uri.joinPath(extensionUri, "images", "icon.svg");

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
      t(
        `Feedback Loop: 打开面板失败 - ${err instanceof Error ? err.message : "未知错误"}`,
        `Feedback Loop: Failed to create panel - ${err instanceof Error ? err.message : "Unknown error"}`,
      ),
    );
    return;
  }

  let responseSent = false;
  const statusWatcher = setInterval(() => {
    if (responseSent) return;
    if (!panel.visible) return;
    if (hasRequestLeftPending(request.requestId)) {
      responseSent = true;
      panel.dispose();
    }
  }, 1000);

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
                  /(\[图片已附加\]|\[Image attached\])[\s\S]*$/,
                  `${t("[图片已附加]", "[Image attached]")}\n${imagePath}`,
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
              t(
                `发送失败：${error instanceof Error ? error.message : "未知错误"}。你可以重试。`,
                `Failed to send response: ${error instanceof Error ? error.message : "Unknown error"}. You can try again.`,
              ),
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
              t(
                `发送失败：${error instanceof Error ? error.message : "未知错误"}。你可以重试。`,
                `Failed to send response: ${error instanceof Error ? error.message : "Unknown error"}. You can try again.`,
              ),
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
    clearInterval(statusWatcher);
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
  const logoUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "images", "icon.svg"),
  );
  const templatePath = path.join(
    extensionUri.fsPath,
    "dist",
    "views",
    "dialog",
    "inbox.html",
  );
  const options = request.options || [];

  const optionsHtml =
    options.length > 0
      ? `
    <div class="options-section">
      <div class="options-label">${t("快捷选项:", "Quick options:")}</div>
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
      `<span class="meta-pill">${t("项目", "Project")} <span class="meta-val">${escapeHtml(projectName)}</span></span>`,
    );
  }
  if (request.model) {
    metaParts.push(
      `<span class="meta-pill">${t("模型", "Model")} <span class="meta-val">${escapeHtml(request.model)}</span></span>`,
    );
  }
  if (request.title) {
    metaParts.push(
      `<span class="meta-pill">${t("标题", "Title")} <span class="meta-val green">${escapeHtml(request.title)}</span></span>`,
    );
  }
  if (request.agentId) {
    metaParts.push(
      `<span class="meta-pill">${t("代理", "Agent")} <span class="meta-val">${escapeHtml(request.agentId)}</span></span>`,
    );
  }
  const metaInfoHtml = metaParts.length > 0 ? metaParts.join("") : "";

  const headerTitle = request.title || t("反馈收件箱", "Feedback Loop Inbox");
  const headerContextHtml = request.context
    ? `<div class="header-context">${escapeHtml(request.context)}</div>`
    : "";

  const template = fs.readFileSync(templatePath, "utf-8");
  return template
    .replace(/\{\{REASON\}\}/g, escapeHtml(request.reason))
    .replace(/\{\{REQUEST_ID\}\}/g, escapeHtml(request.requestId))
    .replace(/\{\{OPTIONS_HTML\}\}/g, optionsHtml)
    .replace(/\{\{META_INFO_HTML\}\}/g, metaInfoHtml)
    .replace(/\{\{HEADER_TITLE\}\}/g, headerTitle)
    .replace(/\{\{HEADER_CONTEXT_HTML\}\}/g, headerContextHtml)
    .replace(/\{\{LOGO_URI\}\}/g, logoUri.toString())
    .replace(/\{\{CSS_URI\}\}/g, cssUri.toString())
    .replace(/\{\{SECTION_SUMMARY\}\}/g, t("摘要", "Summary"))
    .replace(/\{\{SECTION_RESPONSE\}\}/g, t("回复", "Response"))
    .replace(/\{\{LABEL_YOUR_RESPONSE\}\}/g, t("你的回复", "Your response"))
    .replace(
      /\{\{LABEL_RESPONSE_HINT\}\}/g,
      t("(或点击上面的快捷选项)", "(or pick an option above)"),
    )
    .replace(
      /\{\{LABEL_PLACEHOLDER\}\}/g,
      t("请输入你的指令...", "Type your instructions here..."),
    )
    .replace(/\{\{LABEL_ATTACH_IMAGE\}\}/g, t("附加图片", "Attach image"))
    .replace(
      /\{\{LABEL_DROP_IMAGE\}\}/g,
      t("Ctrl+V 粘贴或拖拽图片到此处", "Ctrl+V to paste or drag image here"),
    )
    .replace(/\{\{LABEL_REMOVE\}\}/g, t("移除", "Remove"))
    .replace(/\{\{LABEL_SEND\}\}/g, t("发送", "Send"))
    .replace(/\{\{LABEL_END\}\}/g, t("结束", "End"))
    .replace(/\{\{LABEL_SHORTCUT_SEND\}\}/g, t("发送", "to send"))
    .replace(/\{\{LABEL_COPIED\}\}/g, t("已复制!", "Copied!"))
    .replace(
      /\{\{IMAGE_ATTACHED_MARKER\}\}/g,
      t("[图片已附加]", "[Image attached]"),
    );
}
