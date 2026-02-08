# Prompts 提示词管理

本目录包含 AI 工作流同步协议的规则和模板。

## 目录结构

```
prompts/
├── core/                           # 核心协议规则
│   ├── io-protocol.md              # MCP 方案（需要 MCP Server）
│   └── terminal-feedback-protocol.md  # 终端方案（MCP 受限备用）
├── templates/                      # IDE 规则模板
│   ├── windsurf.txt                # MCP 方案模板
│   └── windsurf-terminal.txt       # 终端方案模板
└── examples/                       # 使用示例
```

## 两种方案

| 方案 | 文件 | 适用场景 |
|------|------|----------|
| MCP 方案 | `io-protocol.md` | Windsurf 允许 MCP 工具时 |
| Terminal 方案 | `terminal-feedback-protocol.md` | MCP 被禁用时（Permission denied）|

## 使用方法

### MCP 方案（推荐）
1. 复制 `templates/windsurf.txt` 到项目的 `.windsurfrules`
2. 确保 MCP Server 已配置

### Terminal 方案（备用）
1. 复制 `templates/windsurf-terminal.txt` 到项目的 `.windsurfrules`
2. 运行 `python -m terminal_feedback --configure` 完成配置
