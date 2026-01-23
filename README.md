# Session Helper - MCP 开发辅助工具

> ⚠️ **仅支持 Windsurf IDE**

让 AI 对话永不结束，在一次对话中无限次交互。

## 👤 作者

**Peak Xiong** - [GitHub](https://github.com/peak-xiong)

---

## 🚀 安装

### Windows

```cmd
install.bat
```

### macOS / Linux

```bash
chmod +x install.sh
./install.sh
```

### 规则文件位置

| 平台 | 路径 |
|------|------|
| Windows | `%USERPROFILE%\.windsurfrules` |
| macOS/Linux | `~/.windsurfrules` 或 `~/.codeium/windsurf/memories/global_rules.md` |

---

## 📁 项目结构

```
├── install.bat / install.sh   # 安装脚本
├── uninstall.bat / uninstall.sh
├── server/                    # MCP 服务器 (Python)
│   ├── server.py
│   ├── setup.py
│   └── requirements.txt
├── extension/                 # VS Code 扩展 (TypeScript)
├── rules/                     # 规则模板
└── scripts/                   # 工具脚本
    └── rename.py              # 快速重命名工具
```

---

## 🔄 快速重命名（突破屏蔽）

当名称被屏蔽时，修改 `scripts/rename.py` 中的 `NAME` 变量：

```python
NAME = "dev-helper"  # 改成新名称
```

然后运行：

```bash
python3 scripts/rename.py
cd extension && npm run compile && npm run package
./install.sh  # 或 install.bat
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
