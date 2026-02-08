/**
 * Request types
 */
export interface AskRequest {
  type: string;
  requestId: string;
  reason: string;
  options?: string[];
  callbackPort?: number;
}
