# Session Helper - MCP 开发辅助工具

> ⚠️ **仅支持 Windsurf IDE**

让 AI 对话永不结束，在一次对话中无限次交互。

## 👤 作者

**Peak Xiong** - [GitHub](https://github.com/peak-xiong)

---

## 🚀 快速安装

### 一键安装

```bash
# macOS / Linux
python3 scripts/install.py

# Windows (双击运行)
scripts\install.bat
```

安装脚本会自动完成：
1. 创建 Python 虚拟环境
2. 安装 MCP Server 依赖
3. 配置 Windsurf MCP
4. 安装 VS Code 扩展
5. 配置全局规则

### 手动安装

```bash
# 1. 编译扩展
cd extension
npm install
npm run package   # → dist/io-util.vsix

# 2. 安装扩展
windsurf --install-extension extension/dist/io-util.vsix

# 3. 配置 MCP
python3 server/setup.py
```

### 开发版本更新

```bash
cd extension
npm run release          # patch: 1.3.0 → 1.3.1
npm run release:minor    # minor: 1.3.0 → 1.4.0
npm run release:major    # major: 1.3.0 → 2.0.0

python3 scripts/install.py  # 重新安装
```

---

## 🗑️ 卸载

```bash
python3 scripts/uninstall.py
```

---

## 📁 项目结构

```
session-helper/
├── server/                 # MCP 服务器 (Python)
│   ├── main.py             # 入口点
│   ├── config.py           # 配置常量
│   ├── models/             # 数据库模型
│   ├── handlers/           # 请求处理
│   └── utils/              # 工具函数
├── extension/              # VS Code 扩展 (TypeScript)
│   ├── src/core/           # 核心逻辑
│   ├── src/views/          # UI 组件
│   ├── src/server/         # HTTP 服务
│   └── dist/               # 编译输出
├── prompts/                # 规则模板
│   ├── core/               # 核心协议
│   └── templates/          # IDE 模板
└── scripts/                # 工具脚本
```

---

## 🔧 MCP 工具

| 工具 | 说明 |
|------|------|
| `io` | 发送检查点，暂停等待用户输入 |
| `pause` | 无限期暂停，等待用户手动恢复 |
| `join` | 创建 agent 身份，记录模型信息 |
| `recall` | 查找之前的 agent 会话 |

---

## 📡 API 端点

| 端点 | 说明 |
|------|------|
| `GET /agents` | 列出所有 agent（含模型信息）|
| `GET /history` | 最近 20 条会话 |
| `GET /pending` | 待处理请求 |

```bash
curl http://127.0.0.1:23984/agents
```

---

## 🛠️ 常用命令

| 命令 | 说明 |
|------|------|
| `IO Util: Open Panel` | 重新打开弹窗 |
| `IO Util: Show Status` | 查看状态 |
| `IO Util: Restart` | 重启服务 |

---

## 📄 License

MIT License
