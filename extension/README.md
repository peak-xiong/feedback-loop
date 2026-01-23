# Session Helper Extension

VS Code/Windsurf 扩展，提供会话检查点弹窗界面。

## 功能

- 🔄 会话检查点弹窗
- 📋 剪贴板图片支持
- 🖱️ 拖拽上传图片

## 安装

1. `Ctrl+Shift+P` → `Extensions: Install from VSIX`
2. 选择 `session-helper-1.2.0.vsix`
3. 重启 IDE

## 命令

| 命令 | 说明 |
|------|------|
| `Session Helper: Open Panel` | 打开弹窗 |
| `Session Helper: Show Status` | 查看状态 |
| `Session Helper: Restart` | 重启服务 |

## 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `sessionHelper.serverPort` | 23983 | HTTP 服务端口 |
| `sessionHelper.autoStart` | true | 自动启动服务 |

## License

MIT License
