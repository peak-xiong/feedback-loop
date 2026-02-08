/**
 * @deprecated This module is not currently in use.
 * The active workflow uses file-system based communication (CLI ↔ Extension).
 * Retained for potential future use as an HTTP REST alternative.
 *
 * Feedback API Server - 主入口
 */

import express from "express";
import cors from "cors";
import feedbackRoutes from "./routes/feedback";
import sessionRoutes from "./routes/session";

const app = express();
const PORT = process.env.PORT || 4041;

// 中间件
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// 路由
app.use("/feedback", feedbackRoutes);
app.use("/session", sessionRoutes);

// 健康检查
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`[Server] Feedback API running on http://localhost:${PORT}`);
  console.log(`[Server] Endpoints:`);
  console.log(`  - POST   /session/create`);
  console.log(`  - GET    /session/:id`);
  console.log(`  - GET    /session/list/all`);
  console.log(`  - DELETE /session/:id`);
  console.log(`  - POST   /feedback/request`);
  console.log(`  - GET    /feedback/wait/:id`);
  console.log(`  - POST   /feedback/submit/:id`);
  console.log(`  - GET    /feedback/pending`);
  console.log(`  - GET    /health`);
});
