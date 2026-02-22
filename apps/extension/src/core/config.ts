/**
 * Extension configuration constants
 */
import * as path from "path";
import * as vscode from "vscode";

export const REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// 文件系统目录（按项目隔离）
export let BASE_DIR = "";
export let REQUESTS_DIR = "";
export let PENDING_DIR = "";
export let COMPLETED_DIR = "";
export let IMAGES_DIR = "";

function normalizeProjectRoot(input: string): string {
  return path.resolve(input);
}

export function getPrimaryWorkspaceRoot(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  if (workspaceFolders.length === 0) {
    return null;
  }
  return workspaceFolders[0].uri.fsPath;
}

export function setProjectRoot(projectRoot: string): void {
  const root = normalizeProjectRoot(projectRoot);
  BASE_DIR = path.join(root, ".windsurf", "feedback-loop");
  REQUESTS_DIR = path.join(BASE_DIR, "requests");
  PENDING_DIR = path.join(REQUESTS_DIR, "pending");
  COMPLETED_DIR = path.join(REQUESTS_DIR, "completed");
  IMAGES_DIR = path.join(REQUESTS_DIR, "images");
}
