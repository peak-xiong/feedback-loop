# Feedback Loop Extension

VS Code/Windsurf 扩展，提供会话检查点弹窗界面。

## 功能

- 🔄 会话检查点弹窗
- 📋 剪贴板图片支持
- 🖱️ 拖拽上传图片
- 📁 基于文件系统的通信机制

## 安装

### 方式 1: 命令行安装

```bash
# 编译打包
npm install && npm run release

# VSCode
code --install-extension dist/feedback-loop.vsix --force

# Windsurf
windsurf --install-extension dist/feedback-loop.vsix --force
```

### 方式 2: 手动安装

1. `Ctrl+Shift+P` → `Extensions: Install from VSIX`
2. 选择 `dist/feedback-loop.vsix`
3. 重新加载窗口: `Developer: Reload Window`

## 命令

| 命令 | 说明 |
|------|------|
| `Feedback Loop: Open Panel` | 打开弹窗 |
| `Feedback Loop: Show Status` | 查看状态 |
| `Feedback Loop: Restart` | 重启服务 |

## 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `feedbackLoop.autoStart` | true | 自动启动监听 |

## 工作原理

扩展监听当前项目目录下 `.windsurf/feedback-loop/requests/pending/`，当 CLI 写入请求文件后：

1. 扩展检测到新文件
2. 弹出对话框请求用户输入
3. 用户提交后写入响应到 `.windsurf/feedback-loop/requests/completed/`
4. 删除 pending 中的请求文件

## License

MIT License

## Logo Attribution

- Logo source: [Flaticon - Metaverse icon](https://www.flaticon.com/free-icon/metaverse_11171244?term=infinite&page=1&position=66&origin=search&related_id=11171244)
- Local assets:
  - `apps/extension/images/metaverse.png` (original design file)
  - `apps/extension/images/metaverse.svg` (vectorized source)
  - `apps/extension/images/icon.png` / `apps/extension/images/icon.svg` / `apps/extension/images/activitybar-icon.svg` (extension runtime assets)
