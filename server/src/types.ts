/**
 * 数据类型定义
 */

// =============================================================================
// Session
// =============================================================================

export interface Session {
  id: string;
  projectPath: string;
  clientId?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface CreateSessionParams {
  projectPath: string;
  clientId?: string;
}

// =============================================================================
// Feedback
// =============================================================================

export type FeedbackStatus = 'pending' | 'completed' | 'timeout';

export interface FeedbackRequest {
  id: string;
  sessionId?: string;
  project: string;
  summary: string;
  status: FeedbackStatus;
  createdAt: string;
  timeout: number;
}

export interface FeedbackResponse {
  requestId: string;
  content: string;
  images?: string[];
  timestamp: string;
}

export interface CreateFeedbackParams {
  sessionId?: string;
  project: string;
  summary: string;
  timeout?: number;
}

// =============================================================================
// API Response
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
