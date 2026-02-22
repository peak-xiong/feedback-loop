# Feedback CLI 调用协议

> 当前主链路：通过 `feedback` CLI（文件协议）收集用户反馈。

## ⚠️ 使用场景

当你处于 Windsurf/VSCode 对话流程中，需要在每轮结束后继续向用户收集下一步指令时，使用此方案。

## 核心原理

通过终端命令调用 `feedback` CLI，CLI 写入 `requests/{id}.json`（`status: pending`）并阻塞，等待扩展弹窗提交响应。

```text
AI 完成任务 → 运行 feedback 命令 → IDE 扩展弹窗（阻塞）→ 用户提交 → 命令返回 → AI 继续
```

## 必须调用的时机

与 `io-protocol.md` 相同：
1. **对话开始** - 用户发送第一条消息后
2. **回复用户后** - 任何回复内容之后
3. **任务完成** - 代码修改、文件操作完成后
4. **用户结束语** - 用户说"谢谢"、"好的"时
5. **提问后** - 向用户提问后

## 调用方式

### 推荐命令
```bash
uv run --project ./apps/feedback-cli feedback -p "项目路径" -s "AI工作完成摘要" -m "模型名称" -t "会话标题" -o "继续,修改,完成"
```

> 说明：使用仓库相对路径 `./apps/feedback-cli`，避免在不同设备上依赖绝对路径。

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `-p, --project` | 项目目录路径 | `-p "/path/to/project"` |
| `-s, --summary` | 工作完成摘要 | `-s "修复了登录bug"` |
| `-m, --model` | 模型名 | `-m "Claude Sonnet"` |
| `-t, --title` | 对话标题 | `-t "登录模块修复"` |
| `-o, --options` | 快捷选项 | `-o "继续,修改,完成"` |
| `--stdin` | 从 stdin 读取 JSON | `--stdin` |

## ✅ 正确示例

```
用户: 帮我修复登录bug

AI: [分析问题、修改代码...]
    我已经修复了登录问题，主要修改了...

    [运行终端命令]
    uv run --project ./apps/feedback-cli feedback -p "/path/to/project" -s "修复登录bug：修改了auth.py中的验证逻辑" -o "继续,继续排查,完成"

    [等待 GUI 返回用户反馈]
    
    收到反馈: "请也检查一下注册功能"
    
    [继续处理反馈...]
```

## ❌ 禁止行为

- ❌ 不运行反馈命令就结束回复
- ❌ 假设用户没有更多需求
- ❌ 以任何理由跳过反馈收集
