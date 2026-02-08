/**
 * Database Service - SQLite 数据库服务
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Session, FeedbackRequest, FeedbackResponse } from '../types';

// 数据库路径
const DB_DIR = path.join(os.homedir(), '.session-helper');
const DB_PATH = path.join(DB_DIR, 'data.db');

// 确保目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// 创建数据库连接
const db = new Database(DB_PATH);

// 初始化表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    projectPath TEXT NOT NULL,
    clientId TEXT,
    createdAt TEXT NOT NULL,
    lastActiveAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback_requests (
    id TEXT PRIMARY KEY,
    sessionId TEXT,
    project TEXT NOT NULL,
    summary TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL,
    timeout INTEGER NOT NULL DEFAULT 600000,
    FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS feedback_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requestId TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    images TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (requestId) REFERENCES feedback_requests(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_requests_session ON feedback_requests(sessionId);
  CREATE INDEX IF NOT EXISTS idx_requests_status ON feedback_requests(status);
`);

console.log(`[DB] SQLite database initialized at ${DB_PATH}`);

// =============================================================================
// Session 操作
// =============================================================================

export function createSession(id: string, projectPath: string, clientId?: string): Session {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO sessions (id, projectPath, clientId, createdAt, lastActiveAt)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, projectPath, clientId || null, now, now);
  return { id, projectPath, clientId, createdAt: now, lastActiveAt: now };
}

export function getSession(id: string): Session | undefined {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(id) as Session | undefined;
}

export function listSessions(): Session[] {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY lastActiveAt DESC');
  return stmt.all() as Session[];
}

export function updateSessionActivity(id: string): void {
  const stmt = db.prepare('UPDATE sessions SET lastActiveAt = ? WHERE id = ?');
  stmt.run(new Date().toISOString(), id);
}

export function deleteSession(id: string): boolean {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// =============================================================================
// Feedback Request 操作
// =============================================================================

export function createFeedbackRequest(request: FeedbackRequest): void {
  const stmt = db.prepare(`
    INSERT INTO feedback_requests (id, sessionId, project, summary, status, createdAt, timeout)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    request.id,
    request.sessionId || null,
    request.project,
    request.summary,
    request.status,
    request.createdAt,
    request.timeout
  );
  
  // 更新 Session 活动时间
  if (request.sessionId) {
    updateSessionActivity(request.sessionId);
  }
}

export function getFeedbackRequest(id: string): FeedbackRequest | undefined {
  const stmt = db.prepare('SELECT * FROM feedback_requests WHERE id = ?');
  return stmt.get(id) as FeedbackRequest | undefined;
}

export function getPendingFeedbackRequests(sessionId?: string): FeedbackRequest[] {
  if (sessionId) {
    const stmt = db.prepare('SELECT * FROM feedback_requests WHERE status = ? AND sessionId = ? ORDER BY createdAt DESC');
    return stmt.all('pending', sessionId) as FeedbackRequest[];
  }
  const stmt = db.prepare('SELECT * FROM feedback_requests WHERE status = ? ORDER BY createdAt DESC');
  return stmt.all('pending') as FeedbackRequest[];
}

export function updateFeedbackRequestStatus(id: string, status: string): void {
  const stmt = db.prepare('UPDATE feedback_requests SET status = ? WHERE id = ?');
  stmt.run(status, id);
}

// =============================================================================
// Feedback Response 操作
// =============================================================================

export function createFeedbackResponse(response: FeedbackResponse): void {
  const stmt = db.prepare(`
    INSERT INTO feedback_responses (requestId, content, images, timestamp)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(
    response.requestId,
    response.content,
    response.images ? JSON.stringify(response.images) : null,
    response.timestamp
  );
  
  // 更新请求状态
  updateFeedbackRequestStatus(response.requestId, 'completed');
}

export function getFeedbackResponse(requestId: string): FeedbackResponse | undefined {
  const stmt = db.prepare('SELECT * FROM feedback_responses WHERE requestId = ?');
  const row = stmt.get(requestId) as { requestId: string; content: string; images: string | null; timestamp: string } | undefined;
  if (!row) return undefined;
  return {
    requestId: row.requestId,
    content: row.content,
    images: row.images ? JSON.parse(row.images) : undefined,
    timestamp: row.timestamp,
  };
}

export default db;
