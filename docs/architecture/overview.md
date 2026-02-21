# Feedback Loop 架构总览
## 目标
在 Windsurf/VSCode 中实现“每轮回复后可继续交互”，避免模型自然结束会话。

## 组件边界
- `apps/feedback-cli`（Python）
  - 生成反馈请求（pending）
  - 阻塞等待反馈响应（completed）
- `apps/extension`（TypeScript）
  - 轮询 pending 请求
  - 弹出 Webview 对话框采集输入
  - 写入 completed 响应并提供会话管理 UI
- `packages/protocol`
  - 提供 JSON Schema，定义跨语言通信字段
- `docs/prompts`
  - 提供规则模板，保证模型在关键节点触发 CLI

## 数据流
1. 模型执行 `feedback` CLI
2. CLI 写入 `~/.feedback-loop/requests/pending/{id}.json`
3. 扩展发现请求并弹窗
4. 用户提交输入
5. 扩展写入 `~/.feedback-loop/requests/completed/{id}.json`
6. CLI 读到响应后返回模型继续执行

## 并发与归属
- 请求级锁：防止多个窗口重复消费同一 request
- 会话级归属锁（`sessionId`/`agentId`）：同一会话仅由一个窗口处理
- 窗口级过滤：仅当前聚焦且工作区匹配的窗口处理请求
