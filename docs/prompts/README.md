# Prompts 提示词管理
本目录维护 Windsurf/VSCode 的规则模板，目标是强制模型在每轮结束后调用 feedback CLI。

## 目录结构
```text
docs/prompts/
├── core/
│   └── terminal-feedback-protocol.md
└── templates/
    └── windsurf-terminal.txt
```

## 推荐方案
- 优先使用 `templates/windsurf-terminal.txt`
- 复制到项目 `.windsurfrules` 或全局规则文件后，模型将持续触发 `feedback` 命令

## 说明
- 当前主链路是 CLI 文件协议方案。
