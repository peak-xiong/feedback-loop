# Feedback Loop Protocol
本目录是跨语言协议的单一事实源（SSOT），用于约束 `apps/feedback-cli` 与 `apps/extension` 的通信格式。

## 协议文件
- `schemas/pending-request.schema.json`：CLI 写入 `pending/` 的请求格式
- `schemas/completed-response.schema.json`：扩展写入 `completed/` 的响应格式
- `schemas/ask-request.schema.json`：扩展内部统一的弹窗请求格式

## 设计原则
- 字段命名统一：跨语言统一使用 camelCase
- 时间格式统一：ISO 8601 字符串（`date-time`）
- 字段语义清晰：请求与响应字段职责明确

## 版本策略
当前协议版本：`v1`
- 非破坏性字段扩展：同版本内迭代
- 破坏性变更：升级主版本并提供迁移说明
