/**
 * Polling Client - 使用项目内文件系统与 CLI 通信
 */
import * as fs from "fs";
import * as path from "path";
import { AskRequest, FeedbackMetadata, PendingRequest } from "../types";
import { REQUESTS_DIR } from "../core/config";

let watchInterval: NodeJS.Timeout | null = null;
let isPolling = false;

// 已处理的请求 ID（限制容量防止内存泄漏）
const MAX_PROCESSED_CACHE = 200;
const processedRequests = new Set<string>();

/**
 * 确保目录存在
 */
function ensureDirs(): void {
  if (!REQUESTS_DIR) {
    throw new Error("Project root is not initialized");
  }
  if (!fs.existsSync(REQUESTS_DIR)) {
    fs.mkdirSync(REQUESTS_DIR, { recursive: true });
  }
}

/**
 * 获取待处理的反馈请求
 */
function getPendingRequests(): PendingRequest[] {
  ensureDirs();
    const requests: PendingRequest[] = [];

  try {
    const files = fs.readdirSync(REQUESTS_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(REQUESTS_DIR, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        const status = typeof data?.status === "string" ? data.status : "pending";
        if (data?.id && status === "pending") {
          requests.push(data);
        }
      } catch {
        // 忽略解析错误
      }
    }
  } catch {
    // 目录不存在或无法读取
  }

  return requests;
}

/**
 * 提交反馈（写入响应文件）
 */
export async function submitFeedback(
  requestId: string,
  content: string,
  images?: string[],
  metadata?: FeedbackMetadata,
): Promise<boolean> {
  try {
    ensureDirs();

    const requestFile = path.join(REQUESTS_DIR, `${requestId}.json`);
    const current = fs.existsSync(requestFile)
      ? JSON.parse(fs.readFileSync(requestFile, "utf-8"))
      : { id: requestId };

    const status =
      content === "[end]"
        ? "ended"
        : content === "[cancelled]"
          ? "cancelled"
          : "completed";
    const response = {
      ...current,
      id: current.id || requestId,
      status,
      content,
      images: images || [],
      timestamp: new Date().toISOString(),
      model: metadata?.model,
      sessionId: metadata?.sessionId,
      title: metadata?.title,
      agentId: metadata?.agentId,
    };

    fs.writeFileSync(requestFile, JSON.stringify(response, null, 2), "utf-8");
    console.log(`[PollingClient] 响应已写入请求文件: ${requestId}`);
    return true;
  } catch (error) {
    console.error(`[PollingClient] 写入响应失败:`, error);
    return false;
  }
}

/**
 * 转换为 AskRequest 格式
 */
function convertToAskRequest(pending: PendingRequest): AskRequest {
  return {
    type: "feedback",
    requestId: pending.id,
    reason: pending.summary || "用户反馈请求",
    context: pending.project,
    callbackPort: 0,
    // 传递元数据
    model: pending.model,
    sessionId: pending.sessionId,
    title: pending.title,
    agentId: pending.agentId,
    options: pending.options || [],
  };
}

/**
 * 开始轮询文件系统
 */
export function startPolling(
  onRequest: (request: AskRequest) => Promise<void>,
  onStatusChange: (running: boolean, port: number) => void,
  intervalMs: number = 1000,
): void {
  if (isPolling) return;

  ensureDirs();
  isPolling = true;
  onStatusChange(true, 0);
  console.log(`[PollingClient] 开始监听请求目录: ${REQUESTS_DIR}`);

  watchInterval = setInterval(async () => {
    const pending = getPendingRequests();

    for (const request of pending) {
      if (processedRequests.has(request.id)) {
        continue;
      }

      processedRequests.add(request.id);
      if (processedRequests.size > MAX_PROCESSED_CACHE) {
        const first = processedRequests.values().next().value;
        if (first) processedRequests.delete(first);
      }

      console.log(`[PollingClient] 发现新请求: ${request.id}`);
      const askRequest = convertToAskRequest(request);

      try {
        await onRequest(askRequest);
      } catch (error) {
        console.error(`[PollingClient] 处理请求失败: ${request.id}`, error);
        processedRequests.delete(request.id);
      }
    }
  }, intervalMs);
}

/**
 * 停止轮询
 */
export function stopPolling(): void {
  if (watchInterval) {
    clearInterval(watchInterval);
    watchInterval = null;
  }
  isPolling = false;
  processedRequests.clear();
  console.log("[PollingClient] 停止监听");
}

/**
 * 检查是否在轮询
 */
export function isPollingActive(): boolean {
  return isPolling;
}
