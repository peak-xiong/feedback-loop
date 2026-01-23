# Session Helper - MCP 开发辅助工具

> ⚠️ **仅支持 Windsurf IDE**，不支持 VS Code、Cursor 等其他编辑器。

让 AI 对话永不结束，在一次对话中无限次交互。

---

## 👤 作者

**Peak Xiong**

- 🔗 GitHub: [github.com/peak-xiong](https://github.com/peak-xiong)

如果觉得好用，欢迎 Star ⭐ 和关注！

---

## ✨ 功能特点

- 🔄 **无限对话** - AI 完成任务后自动弹窗询问是否继续
- 📋 **剪贴板图片** - 支持 Ctrl+V 粘贴截图
- 🖱️ **拖拽上传** - 拖拽图片到对话框
- 🌍 **全局规则** - 一次配置，所有项目通用

---

## 🧠 工作原理

### 组件架构

| 组件 | 作用 | 运行方式 |
|------|------|----------|
| **MCP Server** (Python) | 提供 `session_checkpoint` 工具 | Windsurf 自动启动 |
| **扩展** (VSIX) | 显示弹窗，接收用户输入 | 安装后自动运行 |

### 工作流程

```
AI 完成任务 → 调用 session_checkpoint → 弹窗询问 → 用户输入 → 继续执行
```

### 关键配置

**MCP 配置**: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "session-helper": {
      "command": "python",
      "args": ["/path/to/server/server.py"]
    }
  }
}
```

---

## 🚀 安装

### 前置要求

- **Windsurf IDE**
- **Python 3.10+**

### 一键安装（推荐）

1. 运行 `install.bat`
2. 手动安装 VSIX 扩展
3. **重启 Windsurf**

### 手动安装

```bash
# 1. 安装依赖
cd server
pip install -r requirements.txt

# 2. 安装扩展
# Ctrl+Shift+P → Extensions: Install from VSIX → 选择 extension/session-helper-1.2.0.vsix

# 3. 配置规则
# 复制 rules/example-windsurfrules.txt 到 ~/.windsurfrules

# 4. 重启 Windsurf
```

---

## ✅ 验证安装

1. 状态栏显示 `Session Helper: 23983`
2. AI 完成任务后弹出对话框

---

## 📁 项目结构

```
├── install.bat          # 安装脚本
├── uninstall.bat        # 卸载脚本
├── server/              # MCP 服务器 (Python)
│   ├── server.py
│   ├── setup.py
│   └── requirements.txt
├── extension/           # VS Code 扩展 (TypeScript)
└── rules/               # 规则模板
```

---

## 🛠️ 常用命令

| 操作 | 命令 |
|------|------|
| 重新打开弹窗 | `Session Helper: Open Panel` |
| 查看状态 | `Session Helper: Show Status` |
| 重启服务 | `Session Helper: Restart` |

---

## 🔧 故障排除

### 弹窗不出现

1. 检查状态栏是否显示 `Session Helper`
2. 检查 `.windsurfrules` 规则是否正确

### MCP 工具不可用

1. 检查 `mcp_config.json` 路径
2. 重启 Windsurf

---

## 📄 License

MIT License
