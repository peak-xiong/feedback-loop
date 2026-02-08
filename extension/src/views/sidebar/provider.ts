/**
 * Sidebar status view provider
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class StatusViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ioUtil.statusView";
  private _view?: vscode.WebviewView;
  private _serverRunning = false;
  private _port = 23983;
  private _requestCount = 0;
  private _templatePath: string;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this._templatePath = path.join(_extensionUri.fsPath, "src", "views", "sidebar", "sidebar.html");
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent();

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "restart":
          vscode.commands.executeCommand("ioUtil.restart");
          break;
        case "showStatus":
          vscode.commands.executeCommand("ioUtil.showStatus");
          break;
        case "openPanel":
          vscode.commands.executeCommand("ioUtil.openPanel");
          break;
      }
    });
  }

  public updateStatus(running: boolean, port: number) {
    this._serverRunning = running;
    this._port = port;
    if (this._view) {
      this._view.webview.html = this._getHtmlContent();
    }
  }

  public incrementRequestCount() {
    this._requestCount++;
    if (this._view) {
      this._view.webview.html = this._getHtmlContent();
    }
  }

  private _getHtmlContent(): string {
    const statusIcon = this._serverRunning ? "🟢" : "🔴";
    const statusText = this._serverRunning ? "Running" : "Stopped";
    const statusClass = this._serverRunning ? "running" : "stopped";

    try {
      let template = fs.readFileSync(this._templatePath, "utf-8");
      return template
        .replace(/\{\{STATUS_ICON\}\}/g, statusIcon)
        .replace(/\{\{STATUS_TEXT\}\}/g, statusText)
        .replace(/\{\{STATUS_CLASS\}\}/g, statusClass)
        .replace(/\{\{PORT\}\}/g, String(this._port))
        .replace(/\{\{REQUEST_COUNT\}\}/g, String(this._requestCount));
    } catch {
      // Fallback to inline template if file not found
      return this._getFallbackHtml(statusIcon, statusText, statusClass);
    }
  }

  private _getFallbackHtml(icon: string, text: string, cls: string): string {
    return `<!DOCTYPE html><html><body>
      <p>${icon} ${text}</p>
      <p>Port: ${this._port}</p>
      <p>Sessions: ${this._requestCount}</p>
    </body></html>`;
  }
}
