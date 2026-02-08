/**
 * Extension configuration constants
 */
import * as path from "path";
import * as os from "os";

export const REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// 文件系统目录
export const BASE_DIR = path.join(os.homedir(), ".session-helper");
export const REQUESTS_DIR = path.join(BASE_DIR, "requests");
export const PENDING_DIR = path.join(REQUESTS_DIR, "pending");
export const COMPLETED_DIR = path.join(REQUESTS_DIR, "completed");
export const IMAGES_DIR = path.join(REQUESTS_DIR, "images");
