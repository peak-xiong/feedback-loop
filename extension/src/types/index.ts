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
