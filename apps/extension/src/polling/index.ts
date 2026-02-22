/**
 * Polling module - 使用文件系统轮询与 CLI 通信
 */
export {
  startPolling as startServer,
  stopPolling as stopServer,
  isPollingActive as isServerRunning,
  submitFeedback,
} from "./feedbackClient";
export type { FeedbackMetadata } from "../types";
