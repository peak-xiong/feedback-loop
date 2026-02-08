# Session Helper - MCP 开发辅助工具

> ⚠️ **仅支持 Windsurf IDE**

让 AI 对话永不结束，在一次对话中无限次交互。

## 👤 作者

**Peak Xiong** - [GitHub](https://github.com/peak-xiong)

---

## 🚀 安装

```bash
# macOS / Linux
python3 scripts/install.py

# Windows (双击运行)
scripts\install.bat
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
│   │   ├── schemas.py      # SQLModel 定义
│   │   ├── database.py     # 数据库连接
│   │   └── crud.py         # CRUD 操作
│   ├── handlers/           # 请求处理
│   │   ├── http_handler.py # HTTP 回调
│   │   └── mcp_tools.py    # MCP 工具定义
│   └── utils/              # 工具函数
├── extension/              # VS Code 扩展 (TypeScript)
├── rules/                  # 规则模板
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

### join 参数示例
```json
{
  "context": "任务描述",
  "model": "Claude Sonnet", 
  "credits_spent": 5
}
```

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

## 🔄 快速重命名（突破屏蔽）

```bash
# 1. 编辑 NAME
vim scripts/rename.py

# 2. 运行
python3 scripts/rename.py

# 3. 重新编译
cd extension && npm run compile && npm run package

# 4. 重新安装
python3 scripts/install.py
```

---

## 🛠️ 常用命令

| 命令 | 说明 |
|------|------|
| `Session Helper: Open Panel` | 重新打开弹窗 |
| `Session Helper: Show Status` | 查看状态 |
| `Session Helper: Restart` | 重启服务 |

---

## 📄 License

MIT License
