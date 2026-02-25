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
CLI 写入 <project>/.windsurf/feedback-loop/requests/{id}.json
    ↓
扩展轮询并在 IDE 内弹窗
    ↓
用户提交反馈
    ↓
扩展回写同一个请求文件（`status != pending`）
    ↓
CLI 读取后删除该请求文件并返回给模型继续执行
```

## 用户安装（无需打包）

```bash
# 一键安装：CLI 全局 + 预编译扩展 + 规则模板
bash scripts/install.sh
# 或
make install
```

## 开发者发布（一键完成）

```bash
# bump 版本 → 打包 → 同步 prebuilt → 安装 → 规则
bash scripts/release.sh
# 或
make release
```

## CLI 用法

```bash
cd /path/to/feedback-loop/apps/feedback-cli
uv run feedback -p "项目目录" -s "工作摘要" -m "模型名称" -t "对话标题" -o "继续,修改,完成"
```

## 关键路径

- `<project>/.windsurf/feedback-loop/requests/`：请求与响应单目录
- `docs/prompts/templates/`：规则模板
- `packages/protocol/`：协议规范

## 质量检查

```bash
# 本地 CI 检查（协议 + extension compile + python import）
make ci-check
```

## Logo Attribution

- Source: [Flaticon - Metaverse icon](https://www.flaticon.com/free-icon/metaverse_11171244?term=infinite&page=1&position=66&origin=search&related_id=11171244)
- Local file: `apps/extension/images/metaverse.png`
