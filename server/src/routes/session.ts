/**
 * Session Routes - Session 管理 API
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createSession,
  getSession,
  listSessions,
  deleteSession,
} from '../services/database';
import { ApiResponse, Session, CreateSessionParams } from '../types';

const router = Router();

/**
 * POST /session/create - 创建 Session
 */
router.post('/create', (req: Request, res: Response) => {
  const { projectPath, clientId } = req.body as CreateSessionParams;
  
  if (!projectPath) {
    const response: ApiResponse = {
      success: false,
      error: 'Missing required field: projectPath',
    };
    res.status(400).json(response);
    return;
  }
  
  const id = uuidv4();
  const session = createSession(id, projectPath, clientId);
  
  console.log(`[Session] 创建: ${id} - ${projectPath}`);
  
  const response: ApiResponse<Session> = {
    success: true,
    data: session,
  };
  res.json(response);
});

/**
 * GET /session/:id - 获取 Session
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = getSession(id);
  
  if (!session) {
    const response: ApiResponse = {
      success: false,
      error: 'Session not found',
    };
    res.status(404).json(response);
    return;
  }
  
  const response: ApiResponse<Session> = {
    success: true,
    data: session,
  };
  res.json(response);
});

/**
 * GET /session/list/all - 列出所有 Session
 */
router.get('/list/all', (_req: Request, res: Response) => {
  const sessions = listSessions();
  const response: ApiResponse<Session[]> = {
    success: true,
    data: sessions,
  };
  res.json(response);
});

/**
 * DELETE /session/:id - 删除 Session
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = deleteSession(id);
  
  if (!deleted) {
    const response: ApiResponse = {
      success: false,
      error: 'Session not found',
    };
    res.status(404).json(response);
    return;
  }
  
  console.log(`[Session] 删除: ${id}`);
  
  const response: ApiResponse = {
    success: true,
  };
  res.json(response);
});

export default router;
