# Session Helper - MCP 开发辅助工具

> ⚠️ **仅支持 Windsurf IDE**

让 AI 对话永不结束，在一次对话中无限次交互。

## 👤 作者

**Peak Xiong** - [GitHub](https://github.com/peak-xiong)

---

## 🚀 安装

```bash
python3 install.py
```

> Windows 用户也可双击运行 `install.bat`

### 规则文件位置

| 平台 | 路径 |
|------|------|
| Windows | `%USERPROFILE%\.windsurfrules` |
| macOS/Linux | `~/.windsurfrules` 或 `~/.codeium/windsurf/memories/global_rules.md` |

---

## 🗑️ 卸载

```bash
python3 uninstall.py
```

---

## 📁 项目结构

```
├── install.py / uninstall.py  # 跨平台安装脚本
├── server/                    # MCP 服务器 (Python)
├── extension/                 # VS Code 扩展 (TypeScript)
├── rules/                     # 规则模板
└── scripts/rename.py          # 快速重命名工具
```

---

## 🔄 快速重命名（突破屏蔽）

```bash
# 1. 编辑 scripts/rename.py，修改 NAME
NAME = "dev-helper"  # 改成新名称

# 2. 运行脚本
python3 scripts/rename.py

# 3. 重新编译打包
cd extension && npm run compile && npm run package

# 4. 重新安装
python3 install.py
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
