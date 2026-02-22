/**
 * Request types
 */
export interface AskRequest {
  type: string;
  requestId: string;
  reason: string;
  options?: string[];
  callbackPort?: number;
  // 元信息
  model?: string;
  agentId?: string;
  context?: string;
  sessionId?: string;
  title?: string;
}

export interface FeedbackMetadata {
  model?: string;
  sessionId?: string;
  title?: string;
  agentId?: string;
}

/**
 * 待处理的请求（CLI 写入的文件格式）
 */
export interface PendingRequest {
  id: string;
  status?: string;
  project?: string;
  summary?: string;
  createdAt?: string;
  sessionId?: string;
  model?: string;
  title?: string;
  agentId?: string;
  options?: string[];
  content?: string;
  images?: string[];
  timestamp?: string;
}
