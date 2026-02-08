/**
 * Polling module - 使用文件系统轮询与 CLI 通信
 */
export {
  startPolling as startServer,
  stopPolling as stopServer,
  isPollingActive as isServerRunning,
  submitFeedback,
} from "./feedbackClient";

// FeedbackMetadata 已移至 types/index.ts，从此处重导出保持兼容
export type { FeedbackMetadata } from "../types";
