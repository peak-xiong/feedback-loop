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

## 🧠 工作原理（小白必读）

**不理解原理就很难排查问题，请务必阅读！**

### 这个工具由两部分组成

| 组件 | 作用 | 运行方式 |
|------|------|----------|
| **MCP Server** (Python) | 给 AI 提供 `session_checkpoint` 工具 | Windsurf 自动启动 |
| **Windsurf 扩展** (VSIX) | 显示弹窗界面，接收用户输入 | 安装后自动运行 |

### 完整工作流程

```
你和 AI 对话
    ↓
AI 完成任务，调用 session_checkpoint 工具
    ↓
MCP Server 收到调用，通知扩展
    ↓
扩展弹出对话框："继续对话？"
    ↓
你输入新指令，点击"继续"
    ↓
指令返回给 AI，继续执行
    ↓
循环...
```

### 关键配置文件

Windsurf 通过这个配置文件知道如何启动 MCP Server：

**文件位置**: `C:\Users\你的用户名\.codeium\windsurf\mcp_config.json`

**内容示例**:

```json
{
  "mcpServers": {
    "session-helper": {
      "command": "python",
      "args": ["F:/你的路径/mcp-server-python/server.py"]
    }
  }
}
```

**重要**: 这个文件由 `install.bat` 自动生成，路径是你项目的实际位置。如果你移动了项目文件夹，需要重新运行 `install.bat` 更新路径。

### 为什么不需要手动启动服务器？

Windsurf 启动时会：

1. 读取 `mcp_config.json`
2. 自动执行里面的命令启动 Python 进程
3. 通过标准输入输出与 Python 进程通信

**你不需要手动运行任何东西**，Windsurf 全自动管理。

---

## 🚀 安装教程（保姆级）

### 前置要求

- **Windsurf IDE** - 这是唯一支持的编辑器
- **Python 3.10+** - 用于运行 MCP Server

### 方式一：一键安装（推荐）

1. 双击运行 `install.bat`
2. 按提示手动安装 VSIX 扩展（会自动打开文件位置）
3. **重启 Windsurf**（非常重要！）
4. 完成！

> 💡 **更新时**：再次运行 `install.bat` 即可自动更新全局规则文件（旧文件会备份为 `.windsurfrules.backup`）

### 方式二：手动安装

#### 步骤 1：安装 Python 依赖

打开命令行，进入项目目录：

```bash
cd mcp-server-python
pip install -r requirements.txt
```

#### 步骤 2：安装 Windsurf 扩展

1. 打开 Windsurf
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 `Extensions: Install from VSIX`
4. 选择项目目录下的 `session-helper-1.2.0.vsix` 文件

#### 步骤 3：配置 MCP

创建或编辑文件 `C:\Users\你的用户名\.codeium\windsurf\mcp_config.json`：

```json
{
  "mcpServers": {
    "session-helper": {
      "command": "python",
      "args": ["你的完整路径/mcp-server-python/server.py"]
    }
  }
}
```

**注意**：

- 路径使用正斜杠 `/` 或双反斜杠 `\\`
- 路径必须是绝对路径，例如 `F:/Projects/session-helper/mcp-server-python/server.py`

#### 步骤 4：配置全局规则

**Windows 用户**：
复制 `rules/example-windsurfrules.txt` 的内容到 `C:\Users\你的用户名\.windsurfrules`

**macOS/Linux 用户**：
复制 `rules/example-windsurfrules.txt` 的内容到以下位置之一：

- `~/.windsurfrules` （如果文件不存在或为空，直接覆盖）
- `~/.codeium/windsurf/memories/global_rules.md` （如果已有内容，请将规则追加到文件末尾）

> 💡 **提示**：如果 `global_rules.md` 已存在且包含其他规则，请将 `example-windsurfrules.txt` 的内容追加到文件末尾，而不是替换整个文件。

这个规则文件告诉 AI 在完成任务后必须调用 `session_checkpoint` 工具。

#### 步骤 5：重启 Windsurf

**必须重启**，否则配置不会生效。

---

## ✅ 验证安装成功

1. 打开 Windsurf
2. 查看右下角状态栏，应该显示 `Session Helper: 23983`（数字可能不同）
3. 和 AI 对话，让它做一个简单任务
4. 任务完成后应该自动弹出"继续对话？"窗口

如果没有弹窗，请查看下方故障排除。

---

## 📁 项目结构

```
├── install.bat              # 一键安装脚本
├── uninstall.bat            # 卸载脚本
├── mcp-server-python/       # MCP 服务器（Python）
│   ├── server.py            # 主程序
│   └── requirements.txt     # Python 依赖
├── vscode-extension/        # Windsurf 扩展源码（TypeScript）
├── rules/                   # 规则模板
│   └── example-windsurfrules.txt
└── session-helper-1.2.0.vsix  # 打包好的扩展
```

---

## 🛠️ 常用操作

| 操作 | 方法 |
|------|------|
| **重新打开弹窗** | `Ctrl+Shift+P` → `Session Helper: Open Panel` |
| 查看状态 | `Ctrl+Shift+P` → `Session Helper: Show Status` |
| 重启扩展服务 | `Ctrl+Shift+P` → `Session Helper: Restart` |

---

## 🔧 故障排除

### 问题：弹窗不出现

**检查步骤**：

1. 状态栏是否显示 `Session Helper: 23983`？
   - 如果显示 → 扩展正常，问题在 MCP
   - 如果不显示 → 扩展没装好，重新安装 VSIX
2. AI 是否调用了 `session_checkpoint` 工具？
   - 检查 `.windsurfrules` 是否存在且内容正确

### 问题：MCP 工具不可用 / AI 说没有这个工具

**原因**：Windsurf 没有正确加载 MCP 配置

**解决方案**：

1. 检查 `mcp_config.json` 是否存在且路径正确
2. 确认路径指向的 `server.py` 文件确实存在
3. **重启 Windsurf**

### 问题：不小心关了弹窗

按 `Ctrl+Shift+P` → 输入 `Session Helper: Open Panel` → 回车

### 问题：端口冲突

在 Windsurf 设置中搜索 `sessionHelper.serverPort`，改成其他端口（如 23984）

### 问题：移动了项目文件夹后不工作

重新运行 `install.bat`，它会更新 `mcp_config.json` 中的路径。

---

## ❓ 常见问题 Q&A

> 遇到问题请先自查！此部分会持续更新。

### Q：报错"无法连接到任何 VS Code 扩展"，提示"请确保扩展已安装并在运行"，Windsurf 更新版本后好像用不了了？

**A**：这种问题通常是版本冲突导致的。新版本 Windsurf 更新了对 MCP 的支持，可能与旧版本配置不兼容。

**解决方案**：

1. 先运行 `uninstall.bat` 卸载
2. `git pull` 拉取最新代码
3. 重新运行 `install.bat` 安装
4. 重启 Windsurf

---

## ⚠️ 使用声明

**本项目完全免费开源，禁止任何形式的二次打包售卖！**

---

## 📄 License

MIT License
