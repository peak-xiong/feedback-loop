# Feedback CLI（Python）
`feedback` 是当前主链路中的请求发起端：它将请求写入 `<project>/.windsurf/feedback-loop/requests/pending/`，并阻塞等待扩展写入响应。

## 安装
```bash
cd apps/feedback-cli
uv sync
```

## 使用
```bash
cd apps/feedback-cli
uv run feedback -p "$(pwd)" -s "工作摘要" -m "模型名称" -t "会话标题" -o "继续,修改,完成"
```

## 参数
| 参数 | 说明 |
|---|---|
| `-p, --project` | 项目路径（用于确定 `.windsurf/feedback-loop` 目录） |
| `-s, --summary` | 当前阶段摘要 |
| `-i, --session-id` | 会话 ID |
| `-m, --model` | 模型名称 |
| `-t, --title` | 对话标题 |
| `-o, --options` | 快捷按钮选项（逗号分隔） |
| `--stdin` | 从 stdin 读取 JSON 配置 |
