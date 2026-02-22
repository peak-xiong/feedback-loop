/**
 * Ensure `.windsurf/` is listed in the workspace `.gitignore`.
 *
 * Runs once on activation – if the entry already exists the file is left
 * untouched; otherwise the line is appended (creating the file when needed).
 */
import * as fs from "fs";
import * as path from "path";

const ENTRY = ".windsurf/";

export async function ensureGitignore(workspaceRoot: string): Promise<void> {
  const gitignorePath = path.join(workspaceRoot, ".gitignore");

  // Only act inside a git repository
  const gitDir = path.join(workspaceRoot, ".git");
  if (!fs.existsSync(gitDir)) {
    return;
  }

  let content = "";
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, "utf-8");
    // Check whether the entry already exists (exact line match)
    const lines = content.split(/\r?\n/);
    if (lines.some((l) => l.trim() === ENTRY || l.trim() === ".windsurf")) {
      return; // already covered
    }
  }

  // Append the entry
  const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  const block = `${separator}\n# Windsurf IDE\n${ENTRY}\n`;
  fs.appendFileSync(gitignorePath, block, "utf-8");
}
