# Terminal Feedback - 终端阻塞反馈模块

绕过 Windsurf MCP 限制的替代方案，通过终端命令阻塞实现用户反馈收集。

## 🎯 核心原理

1. **终端命令阻塞**：通过 `input()` 或 `tkinter.mainloop()` 阻塞终端进程
2. **规则注入**：通过 `.windsurfrules` 让 AI 在每次回复后调用本工具
3. **反馈返回**：脚本执行完毕后，反馈输出到 stdout，AI 继续处理

## 📦 使用方式

### 命令行模式

```bash
cd /path/to/session-helper
python -m terminal_feedback --cli --project "$(pwd)" --summary "工作摘要"
```

### GUI 模式

```bash
python -m terminal_feedback --gui --project "$(pwd)" --summary "工作摘要" --timeout 9999
```

### 获取系统信息

```bash
python -m terminal_feedback --system-info
```

### 配置 Windsurf

```bash
python -m terminal_feedback --configure
```

## ⚙️ Windsurf 配置

在 `.windsurfrules` 或 `~/.codeium/windsurf/memories/global_rules.md` 中添加：

```markdown
# AI Interactive Feedback 规则

在每次结束对话时，必须调用 AI 反馈工具：
python /path/to/session-helper/terminal-feedback/cli.py --gui --project "项目路径" --summary "摘要" --timeout 9999

## 使用规则：
1. 在任何流程、任务、对话进行时，必须调用 AI 反馈工具
2. 收到非空反馈时，再次调用并根据反馈调整行为
3. 仅当用户明确表示「结束」时才停止调用
```

## 📝 参数说明

| 参数 | 短选项 | 说明 |
|------|--------|------|
| `--cli` | | 命令行模式 |
| `--gui` | | GUI 模式 |
| `--system-info` | | 获取系统信息 |
| `--configure` | | 配置 Windsurf |
| `--project` | `-p` | 项目目录路径 |
| `--summary` | `-s` | AI 工作完成摘要 |
| `--timeout` | `-t` | 超时时间（秒），默认 600 |
| `--output` | `-o` | 输出文件名 |

## 🔗 与 MCP 方案对比

| 特性 | MCP 方案 | Terminal Feedback |
|------|----------|-------------------|
| Windsurf 兼容 | ❌ 被封禁 | ✅ 正常工作 |
| 依赖 | MCP SDK | 仅 Python 标准库 |
| 阻塞机制 | MCP 等待 | 终端 input/GUI |
| 配置方式 | mcp_config.json | .windsurfrules |
