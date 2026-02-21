# Feedback Loop
让 AI 在 Windsurf / VSCode 中持续交互：模型执行命令后，通过 CLI ↔ 扩展的文件协议弹窗收集用户下一步反馈，而不是退出对话。

## Monorepo 架构（多语言）
```text
feedback-loop/
├── apps/
│   ├── extension/            # TypeScript: VSCode/Windsurf 扩展
│   └── feedback-cli/         # Python: 终端阻塞反馈 CLI
├── packages/
│   └── protocol/             # 协议中心（JSON Schema + 文档）
├── docs/
│   ├── architecture/         # 架构文档
│   └── prompts/              # Windsurf 规则模板/协议说明
└── scripts/                  # 当前可用安装/卸载脚本
```

## 核心工作流
```text
模型执行 feedback CLI
    ↓
CLI 写入 ~/.feedback-loop/requests/pending/{id}.json
    ↓
扩展轮询并在 IDE 内弹窗
    ↓
用户提交反馈
    ↓
扩展写入 ~/.feedback-loop/requests/completed/{id}.json
    ↓
CLI 读取响应并返回给模型继续执行
```

## 5 分钟上手
```bash
# 1) 安装 CLI 依赖
cd apps/feedback-cli
uv sync

# 2) 编译并打包扩展
cd ../extension
npm install
npm run package

# 3) 安装扩展
code --install-extension dist/io-util.vsix --force
# 或 Windsurf
/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf --install-extension dist/io-util.vsix --force
```

## 统一命令入口
```bash
# 安装依赖
make bootstrap

# 打包扩展
make package-ext

# 一键安装（脚本）
make install
```

## CLI 用法
```bash
cd /path/to/feedback-loop/apps/feedback-cli
uv run feedback -p "项目目录" -s "工作摘要" -m "模型名称" -t "对话标题" -o "继续,修改,完成"
```

## 关键路径
- `~/.feedback-loop/requests/pending/`：CLI 请求
- `~/.feedback-loop/requests/completed/`：扩展响应
- `docs/prompts/templates/`：规则模板
- `packages/protocol/`：协议规范

## 质量检查
```bash
# 本地 CI 检查（协议 + extension compile + python import）
make ci-check
```
