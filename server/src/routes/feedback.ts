/**
 * Feedback Routes - 反馈 API
 */

import { Router, Request, Response } from 'express';
import {
  createRequest,
  getRequest,
  getPendingRequests,
  submitFeedback,
  waitForFeedback,
  getResponse,
} from '../services/feedbackService';
import { ApiResponse, FeedbackRequest, FeedbackResponse, CreateFeedbackParams } from '../types';

const router = Router();

/**
 * POST /feedback/request - 创建反馈请求
 */
router.post('/request', (req: Request, res: Response) => {
  const { sessionId, project, summary, timeout } = req.body as CreateFeedbackParams;
  
  if (!project || !summary) {
    const response: ApiResponse = {
      success: false,
      error: 'Missing required fields: project, summary',
    };
    res.status(400).json(response);
    return;
  }
  
  const request = createRequest({ sessionId, project, summary, timeout });
  console.log(`[Feedback] 创建请求: ${request.id} - ${summary.substring(0, 50)}...`);
  
  const response: ApiResponse<FeedbackRequest> = {
    success: true,
    data: request,
  };
  res.json(response);
});

/**
 * GET /feedback/wait/:id - 等待反馈（长轮询）
 */
router.get('/wait/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const timeout = parseInt(req.query.timeout as string) || 30000;
  
  console.log(`[Feedback] 等待反馈: ${id} (timeout: ${timeout}ms)`);
  
  const feedbackResponse = await waitForFeedback(id, timeout);
  
  if (feedbackResponse) {
    console.log(`[Feedback] 收到反馈: ${id}`);
    const response: ApiResponse<FeedbackResponse> = {
      success: true,
      data: feedbackResponse,
    };
    res.json(response);
  } else {
    // 超时或请求不存在，返回空
    const response: ApiResponse = {
      success: true,
      data: null,
    };
    res.json(response);
  }
});

/**
 * POST /feedback/submit/:id - 提交反馈
 */
router.post('/submit/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, images } = req.body as { content: string; images?: string[] };
  
  if (!content) {
    const response: ApiResponse = {
      success: false,
      error: 'Missing required field: content',
    };
    res.status(400).json(response);
    return;
  }
  
  const feedbackResponse = submitFeedback(id, content, images);
  
  if (!feedbackResponse) {
    const response: ApiResponse = {
      success: false,
      error: 'Request not found or already completed',
    };
    res.status(404).json(response);
    return;
  }
  
  console.log(`[Feedback] 提交成功: ${id}`);
  
  const response: ApiResponse<FeedbackResponse> = {
    success: true,
    data: feedbackResponse,
  };
  res.json(response);
});

/**
 * GET /feedback/status/:id - 获取请求状态
 */
router.get('/status/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const request = getRequest(id);
  
  if (!request) {
    const response: ApiResponse = {
      success: false,
      error: 'Request not found',
    };
    res.status(404).json(response);
    return;
  }
  
  const feedbackResponse = getResponse(id);
  
  const response: ApiResponse<{ request: FeedbackRequest; response?: FeedbackResponse }> = {
    success: true,
    data: { request, response: feedbackResponse },
  };
  res.json(response);
});

/**
 * GET /feedback/pending - 获取待处理请求列表
 */
router.get('/pending', (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string | undefined;
  const requests = getPendingRequests(sessionId);
  
  const response: ApiResponse<FeedbackRequest[]> = {
    success: true,
    data: requests,
  };
  res.json(response);
});

export default router;
