/**
 * Utility functions
 */
import * as fs from "fs";
import * as path from "path";
import { IMAGES_DIR } from "../core/config";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * 保存 base64 图片到文件
 * @returns 保存的文件路径
 */
export function saveBase64Image(requestId: string, base64Data: string): string | null {
  try {
    // 解析 data:image/xxx;base64,xxx 格式
    const match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      console.error("Invalid base64 image format");
      return null;
    }

    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const imageData = match[2];

    // 创建 session 图片目录
    const sessionImageDir = path.join(IMAGES_DIR, requestId);
    if (!fs.existsSync(sessionImageDir)) {
      fs.mkdirSync(sessionImageDir, { recursive: true });
    }

    // 生成文件名
    const timestamp = Date.now();
    const filename = `image_${timestamp}.${ext}`;
    const filePath = path.join(sessionImageDir, filename);

    // 解码并保存
    const buffer = Buffer.from(imageData, "base64");
    fs.writeFileSync(filePath, buffer);

    return filePath;
  } catch (err) {
    console.error("Failed to save image:", err);
    return null;
  }
}

/**
 * 删除 session 的图片目录
 */
export function deleteSessionImages(requestId: string): void {
  try {
    if (!IMAGES_DIR || !fs.existsSync(IMAGES_DIR)) {
      return;
    }

    const sessionImageDir = path.join(IMAGES_DIR, requestId);
    if (fs.existsSync(sessionImageDir)) {
      fs.rmSync(sessionImageDir, { recursive: true, force: true });
    }

    // 兼容历史版本：图片可能直接写在 images 根目录，按 requestId 前缀清理
    const files = fs.readdirSync(IMAGES_DIR);
    for (const file of files) {
      if (!file.startsWith(requestId)) continue;
      const p = path.join(IMAGES_DIR, file);
      try {
        if (fs.statSync(p).isFile()) {
          fs.unlinkSync(p);
        }
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error("Failed to delete session images:", err);
  }
}
