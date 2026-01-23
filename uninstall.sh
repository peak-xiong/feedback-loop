#!/bin/bash
# Session Helper - macOS/Linux 卸载脚本

set -e

echo "============================================"
echo "   Session Helper - 卸载脚本"
echo "============================================"
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 卸载扩展
echo "[1/2] 卸载 Windsurf 扩展..."
code --uninstall-extension peak-xiong.session-helper 2>/dev/null || true
echo "[OK] 已尝试卸载扩展"

# 移除 MCP 配置
echo
echo "[2/2] 清理 MCP 配置..."
python3 "$SCRIPT_DIR/server/setup.py" --uninstall || true

echo
echo "============================================"
echo "   卸载完成！"
echo "============================================"
echo
