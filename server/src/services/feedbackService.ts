/**
 * Feedback Service - 反馈请求管理（使用 SQLite）
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createFeedbackRequest,
  getFeedbackRequest,
  getPendingFeedbackRequests,
  updateFeedbackRequestStatus,
  createFeedbackResponse,
  getFeedbackResponse,
} from './database';
import { FeedbackRequest, FeedbackResponse, CreateFeedbackParams } from '../types';

// 等待者队列（用于长轮询）
const waiters = new Map<string, { resolve: (response: FeedbackResponse | null) => void; timer: NodeJS.Timeout }>();

// 默认超时 10 分钟
const DEFAULT_TIMEOUT = 600000;

/**
 * 创建反馈请求
 */
export function createRequest(params: CreateFeedbackParams): FeedbackRequest {
  const id = uuidv4();
  const request: FeedbackRequest = {
    id,
    sessionId: params.sessionId,
    project: params.project,
    summary: params.summary,
    status: 'pending',
    createdAt: new Date().toISOString(),
    timeout: 0, // 永不超时
  };
  
  // 保存到数据库
  createFeedbackRequest(request);
  
  // 不设置超时，请求永久有效
  
  return request;
}

/**
 * 获取请求
 */
export function getRequest(id: string): FeedbackRequest | undefined {
  return getFeedbackRequest(id);
}

/**
 * 获取所有待处理请求
 */
export function getPendingRequests(sessionId?: string): FeedbackRequest[] {
  return getPendingFeedbackRequests(sessionId);
}

/**
 * 提交反馈
 */
export function submitFeedback(requestId: string, content: string, images?: string[]): FeedbackResponse | null {
  const request = getFeedbackRequest(requestId);
  if (!request || request.status !== 'pending') {
    return null;
  }
  
  const response: FeedbackResponse = {
    requestId,
    content,
    images,
    timestamp: new Date().toISOString(),
  };
  
  // 保存到数据库
  createFeedbackResponse(response);
  
  // 通知等待者
  const waiter = waiters.get(requestId);
  if (waiter) {
    clearTimeout(waiter.timer);
    waiter.resolve(response);
    waiters.delete(requestId);
  }
  
  return response;
}

/**
 * 等待反馈（长轮询）
 */
export function waitForFeedback(requestId: string, timeoutMs: number = 30000): Promise<FeedbackResponse | null> {
  const request = getFeedbackRequest(requestId);
  
  // 请求不存在
  if (!request) {
    return Promise.resolve(null);
  }
  
  // 已经有响应
  const existingResponse = getFeedbackResponse(requestId);
  if (existingResponse) {
    return Promise.resolve(existingResponse);
  }
  
  // 请求已超时
  if (request.status === 'timeout') {
    return Promise.resolve(null);
  }
  
  // 等待响应
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(requestId);
      resolve(null);  // 轮询超时，返回 null，客户端应重试
    }, timeoutMs);
    
    waiters.set(requestId, { resolve, timer });
  });
}

/**
 * 获取响应
 */
export function getResponse(requestId: string): FeedbackResponse | undefined {
  return getFeedbackResponse(requestId);
}
