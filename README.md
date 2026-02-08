# Session Helper - AI 反馈交互工具

> ⚠️ **支持 Windsurf / VSCode**

让 AI 对话永不结束，在一次对话中无限次交互。

## 👤 作者

**Peak Xiong** - [GitHub](https://github.com/peak-xiong)

---

## 📋 工作流程

```
大模型执行 CLI 命令
    ↓
CLI 写入请求到 ~/.session-helper/requests/pending/
    ↓
CLI 阻塞等待响应
    ↓
VSCode 扩展监听目录，弹出对话框
    ↓
用户输入反馈，点击提交
    ↓
扩展写入响应到 ~/.session-helper/requests/completed/
    ↓
CLI 读取响应，返回给大模型
    ↓
大模型继续工作
```

## 📂 关键路径

| 路径 | 说明 |
|------|------|
| `~/.session-helper/requests/pending/` | CLI 写入请求 |
| `~/.session-helper/requests/completed/` | 扩展写入响应 |
| `~/.codeium/windsurf/memories/global_rules.md` | Windsurf 规则 |

---

## 🚀 快速安装

```bash
# 1. 安装 feedback CLI
cd feedback && uv sync

# 2. 编译并安装扩展
cd extension
npm install
npm version patch   # 自动更新版本号 (patch/minor/major)
npm run package     # 编译并打包

# 3. 安装到 IDE
# VSCode
code --install-extension dist/io-util.vsix --force

# Windsurf
/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf --install-extension dist/io-util.vsix --force

# 4. 重新加载窗口
# Cmd+Shift+P → "Developer: Reload Window"
```

---

## 🛠️ CLI 使用

```bash
cd /path/to/session-helper/feedback && uv run feedback -p "项目目录" -s "工作摘要"
```

### 参数

| 简写 | 全写 | 说明 |
|------|------|------|
| `-p` | `--project` | 项目目录路径 |
| `-s` | `--summary` | AI 工作摘要 |
| `-i` | `--session-id` | 会话 ID |
| `-m` | `--model` | 模型名称 |
| `-t` | `--title` | 对话标题 |
| `-o` | `--options` | 快捷选项（逗号分隔） |

---

## 📁 项目结构

```
session-helper/
├── feedback/               # CLI 工具 (Python)
│   └── src/feedback/
│       ├── cli.py          # 命令入口
│       ├── collector.py    # 反馈收集
│       └── config.py       # 配置常量
├── extension/              # VS Code 扩展 (TypeScript)
│   ├── src/core/           # 核心逻辑 + 配置
│   ├── src/views/          # UI 组件
│   ├── src/polling/        # 文件轮询
│   ├── src/types/          # 类型定义
│   └── src/utils/          # 工具函数
├── prompts/                # 规则模板
└── scripts/                # 工具脚本
```

---

## 🔧 扩展命令

| 命令 | 说明 |
|------|------|
| `IO Util: Open Panel` | 重新打开弹窗 |
| `IO Util: Show Status` | 查看状态 |
| `IO Util: Restart` | 重启服务 |

---

## 📄 License

MIT License
