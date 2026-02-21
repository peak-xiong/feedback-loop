/**
 * Polling Client - 使用文件系统与 CLI 通信
 */
import * as fs from "fs";
import * as path from "path";
import { AskRequest, FeedbackMetadata, PendingRequest } from "../types";
import { PENDING_DIR, COMPLETED_DIR, LOCKS_DIR } from "../core/config";

let watchInterval: NodeJS.Timeout | null = null;
let isPolling = false;
let lastLockCleanupAt = 0;

// 已处理的请求 ID（限制容量防止内存泄漏）
const MAX_PROCESSED_CACHE = 200;
const processedRequests = new Set<string>();
const STALE_LOCK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LOCK_CLEANUP_INTERVAL_MS = 30 * 1000;
const REQUEST_LOCK_PREFIX = "request-";
const OWNER_LOCK_PREFIX = "owner-";

/**
 * 确保目录存在
 */
function ensureDirs(): void {
  if (!fs.existsSync(PENDING_DIR)) {
    fs.mkdirSync(PENDING_DIR, { recursive: true });
  }
  if (!fs.existsSync(COMPLETED_DIR)) {
    fs.mkdirSync(COMPLETED_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCKS_DIR)) {
    fs.mkdirSync(LOCKS_DIR, { recursive: true });
  }
}

function isClaimedByCurrentProcess(lockFile: string): boolean {
  try {
    const content = fs.readFileSync(lockFile, "utf-8");
    const data = JSON.parse(content) as { pid?: number };
    return data.pid === process.pid;
  } catch {
    return false;
  }
}

/**
 * 获取待处理的反馈请求
 */
function getPendingRequests(): PendingRequest[] {
  ensureDirs();
  const requests: PendingRequest[] = [];

  try {
    const files = fs.readdirSync(PENDING_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(PENDING_DIR, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        requests.push(data);
      } catch {
        // 忽略解析错误
      }
    }
  } catch {
    // 目录不存在或无法读取
  }

  return requests;
}

function encodeLockPart(value: string): string {
  return encodeURIComponent(value);
}

function decodeLockPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getRequestLockFilePath(requestId: string): string {
  return path.join(LOCKS_DIR, `${REQUEST_LOCK_PREFIX}${requestId}.lock`);
}

function getOwnerLockFilePath(ownerKey: string): string {
  return path.join(
    LOCKS_DIR,
    `${OWNER_LOCK_PREFIX}${encodeLockPart(ownerKey)}.lock`,
  );
}

function getOwnerKey(request: PendingRequest): string | null {
  if (request.sessionId?.trim()) {
    return `session:${request.sessionId.trim()}`;
  }
  if (request.agentId?.trim()) {
    return `agent:${request.agentId.trim()}`;
  }
  return null;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    return err.code !== "ESRCH";
  }
}

function isLockStale(lockFile: string): boolean {
  try {
    const content = fs.readFileSync(lockFile, "utf-8");
    const data = JSON.parse(content) as { pid?: number; claimedAt?: string };

    if (typeof data.pid === "number" && Number.isFinite(data.pid)) {
      if (!isProcessAlive(data.pid)) {
        return true;
      }
      return false;
    }

    const stat = fs.statSync(lockFile);
    return Date.now() - stat.mtimeMs > STALE_LOCK_MAX_AGE_MS;
  } catch {
    return true;
  }
}

function tryClaimRequest(requestId: string): boolean {
  ensureDirs();
  const lockFile = getRequestLockFilePath(requestId);
  const lockPayload = JSON.stringify(
    {
      pid: process.pid,
      claimedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  try {
    fs.writeFileSync(lockFile, lockPayload, { encoding: "utf-8", flag: "wx" });
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "EEXIST") {
      console.error(`[PollingClient] 创建锁失败: ${requestId}`, error);
      return false;
    }
  }

  if (isLockStale(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      fs.writeFileSync(lockFile, lockPayload, {
        encoding: "utf-8",
        flag: "wx",
      });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

function releaseClaim(requestId: string): void {
  const lockFile = getRequestLockFilePath(requestId);
  try {
    fs.unlinkSync(lockFile);
  } catch {
    // 忽略删除锁失败
  }
}

function tryClaimOwner(ownerKey: string): boolean {
  ensureDirs();
  const lockFile = getOwnerLockFilePath(ownerKey);
  const lockPayload = JSON.stringify(
    {
      pid: process.pid,
      ownerKey,
      claimedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  try {
    fs.writeFileSync(lockFile, lockPayload, { encoding: "utf-8", flag: "wx" });
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "EEXIST") {
      console.error(`[PollingClient] 创建会话归属锁失败: ${ownerKey}`, error);
      return false;
    }
  }

  if (isClaimedByCurrentProcess(lockFile)) {
    return true;
  }

  if (isLockStale(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      fs.writeFileSync(lockFile, lockPayload, {
        encoding: "utf-8",
        flag: "wx",
      });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

function releaseOwnerClaim(ownerKey: string): void {
  const lockFile = getOwnerLockFilePath(ownerKey);
  if (!isClaimedByCurrentProcess(lockFile)) {
    return;
  }
  try {
    fs.unlinkSync(lockFile);
  } catch {
    // 忽略删除会话锁失败
  }
}

function cleanupStaleLocks(): void {
  ensureDirs();
  try {
    const files = fs.readdirSync(LOCKS_DIR).filter((f) => f.endsWith(".lock"));
    for (const file of files) {
      const lockFile = path.join(LOCKS_DIR, file);

      // 新格式：请求锁
      if (file.startsWith(REQUEST_LOCK_PREFIX)) {
        const requestId = file
          .slice(REQUEST_LOCK_PREFIX.length)
          .replace(/\.lock$/, "");
        const pendingFile = path.join(PENDING_DIR, `${requestId}.json`);
        const completedFile = path.join(COMPLETED_DIR, `${requestId}.json`);
        const pendingExists = fs.existsSync(pendingFile);
        const completedExists = fs.existsSync(completedFile);

        if (!pendingExists && !completedExists) {
          fs.unlinkSync(lockFile);
          continue;
        }

        if (isLockStale(lockFile)) {
          fs.unlinkSync(lockFile);
        }
        continue;
      }

      // 新格式：会话归属锁
      if (file.startsWith(OWNER_LOCK_PREFIX)) {
        const ownerKeyEncoded = file
          .slice(OWNER_LOCK_PREFIX.length)
          .replace(/\.lock$/, "");
        const ownerKey = decodeLockPart(ownerKeyEncoded);
        if (!ownerKey || isLockStale(lockFile)) {
          fs.unlinkSync(lockFile);
        }
        continue;
      }

      // 兼容旧格式：<requestId>.lock（没有前缀）
      const legacyRequestId = file.replace(/\.lock$/, "");
      const legacyPendingFile = path.join(PENDING_DIR, `${legacyRequestId}.json`);
      const legacyCompletedFile = path.join(
        COMPLETED_DIR,
        `${legacyRequestId}.json`,
      );
      const legacyPendingExists = fs.existsSync(legacyPendingFile);
      const legacyCompletedExists = fs.existsSync(legacyCompletedFile);
      if (
        (!legacyPendingExists && !legacyCompletedExists) ||
        isLockStale(lockFile)
      ) {
        fs.unlinkSync(lockFile);
      }
    }
  } catch {
    // 忽略锁清理错误
  }
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

    const responseFile = path.join(COMPLETED_DIR, `${requestId}.json`);
    const response = {
      requestId,
      content,
      images: images || [],
      timestamp: new Date().toISOString(),
      // 元数据
      model: metadata?.model,
      sessionId: metadata?.sessionId,
      title: metadata?.title,
      agentId: metadata?.agentId,
    };

    fs.writeFileSync(responseFile, JSON.stringify(response, null, 2), "utf-8");
    console.log(`[PollingClient] 响应已写入: ${requestId}`);
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
  shouldHandleRequest?: (request: PendingRequest) => boolean,
): void {
  if (isPolling) return;

  ensureDirs();
  isPolling = true;
  onStatusChange(true, 0);
  console.log(`[PollingClient] 开始监听请求目录: ${PENDING_DIR}`);

  // 轮询检查新请求
  watchInterval = setInterval(async () => {
    if (Date.now() - lastLockCleanupAt >= LOCK_CLEANUP_INTERVAL_MS) {
      cleanupStaleLocks();
      lastLockCleanupAt = Date.now();
    }
    const pending = getPendingRequests();

    for (const request of pending) {
      if (processedRequests.has(request.id)) {
        continue;
      }

      if (shouldHandleRequest && !shouldHandleRequest(request)) {
        continue;
      }
      const ownerKey = getOwnerKey(request);
      if (ownerKey && !tryClaimOwner(ownerKey)) {
        continue;
      }

      if (!tryClaimRequest(request.id)) {
        continue;
      }

      processedRequests.add(request.id);
      // 防止内存泄漏：超过容量时清理最早的条目
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
        releaseClaim(request.id);
        if (ownerKey) {
          releaseOwnerClaim(ownerKey);
        }
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
