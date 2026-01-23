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
├── server/              # MCP 服务器 (Python)
│   ├── server.py
│   ├── setup.py
│   └── requirements.txt
├── extension/           # VS Code 扩展 (TypeScript)
├── rules/               # 规则模板
└── scripts/             # 工具脚本
    ├── install.py       # 安装脚本
    ├── uninstall.py     # 卸载脚本
    ├── rename.py        # 快速重命名
    └── *.bat            # Windows 包装器
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
