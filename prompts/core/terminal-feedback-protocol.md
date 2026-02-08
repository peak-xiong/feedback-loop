# Terminal Feedback 工具调用协议

> **MCP 受限时的备用方案**：当 Windsurf 禁用 MCP 工具时，使用终端阻塞方式收集用户反馈。

## ⚠️ 使用场景

当你发现 `io`、`checkpoint` 等 MCP 工具无法使用（Permission denied）时，切换到此方案。

## 核心原理

通过终端命令调用 Python 脚本，脚本弹出 GUI 窗口阻塞会话，直到用户提交反馈。

```text
AI 完成任务 → 运行终端命令 → GUI 弹窗（阻塞）→ 用户提交 → 命令返回 → AI 继续
```

## 必须调用的时机

与 `io-protocol.md` 相同：
1. **对话开始** - 用户发送第一条消息后
2. **回复用户后** - 任何回复内容之后
3. **任务完成** - 代码修改、文件操作完成后
4. **用户结束语** - 用户说"谢谢"、"好的"时
5. **提问后** - 向用户提问后

## 调用方式

### GUI 模式（推荐）
```bash
python -m terminal_feedback --gui --project "项目路径" --summary "AI工作完成摘要" --timeout 9999
```

### CLI 模式
```bash
python -m terminal_feedback --cli --project "项目路径" --summary "工作摘要"
```

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `--gui` | 使用 GUI 界面 | `--gui` |
| `--cli` | 使用命令行界面 | `--cli` |
| `--project` | 项目目录路径 | `--project "/path/to/project"` |
| `--summary` | 工作完成摘要 | `--summary "修复了登录bug"` |
| `--timeout` | 超时时间（秒） | `--timeout 9999` |
| `--system-info` | 仅获取系统信息 | `--system-info` |

## ✅ 正确示例

```
用户: 帮我修复登录bug

AI: [分析问题、修改代码...]
    我已经修复了登录问题，主要修改了...

    [运行终端命令]
    python -m terminal_feedback --gui --project "/Users/xxx/project" --summary "修复登录bug：修改了auth.py中的验证逻辑" --timeout 9999

    [等待 GUI 返回用户反馈]
    
    收到反馈: "请也检查一下注册功能"
    
    [继续处理反馈...]
```

## ❌ 禁止行为

- ❌ 不运行反馈命令就结束回复
- ❌ 假设用户没有更多需求
- ❌ 以任何理由跳过反馈收集

## 与 MCP 方案的对比

| 特性 | MCP 方案 (`io` 工具) | Terminal 方案 |
|------|---------------------|---------------|
| 依赖 | MCP Server | Python + tkinter |
| 触发 | 工具调用 | 终端命令 |
| 阻塞 | MCP 协议 | 进程阻塞 |
| 权限 | 受 Windsurf 限制 | 无限制 |
| UI | 扩展弹窗 | tkinter 窗口 |
