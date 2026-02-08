/**
 * Server module - 使用 Feedback API
 */
export {
  startPolling as startServer,
  stopPolling as stopServer,
  isPollingActive as isServerRunning,
  submitFeedback,
} from "./feedbackClient";

// 保留清理函数兼容性
export async function cleanupOldMcpProcesses(): Promise<void> {
  // 不再需要 MCP 进程清理
  return Promise.resolve();
}
