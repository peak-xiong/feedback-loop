#!/bin/bash
# Session Helper - macOS/Linux 安装脚本

set -e

echo "============================================"
echo "   Session Helper - MCP 工具"
echo "   macOS/Linux 安装脚本"
echo "============================================"
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 检查 Python
echo "[1/5] 检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python3，请先安装 Python 3.10+"
    exit 1
fi
echo "[OK] Python3 已安装: $(python3 --version)"

# 安装 Python 依赖
echo
echo "[2/5] 安装 MCP Server 依赖..."
cd "$SCRIPT_DIR/server"
pip3 install -r requirements.txt -q
echo "[OK] Python 依赖已安装"

# 配置 MCP
echo
echo "[3/5] 配置 MCP..."
python3 "$SCRIPT_DIR/server/setup.py"

# 提示安装扩展
echo
echo "[4/5] 安装 Windsurf 扩展..."
VSIX_FILE="$SCRIPT_DIR/extension/session-helper-1.2.0.vsix"

if [ ! -f "$VSIX_FILE" ]; then
    echo "[警告] VSIX 文件不存在: $VSIX_FILE"
    echo "       请先编译扩展: cd extension && npm run compile && npm run package"
else
    echo "[提示] 请手动安装扩展:"
    echo "       1. 在 Windsurf 中按 Cmd+Shift+P"
    echo "       2. 输入 Extensions: Install from VSIX"
    echo "       3. 选择: $VSIX_FILE"
fi

# 配置全局规则
echo
echo "[5/5] 配置全局规则..."

RULES_SRC="$SCRIPT_DIR/rules/example-windsurfrules.txt"
RULES_DST_1="$HOME/.windsurfrules"
RULES_DST_2="$HOME/.codeium/windsurf/memories/global_rules.md"

if [ ! -f "$RULES_SRC" ]; then
    echo "[警告] 规则模板文件不存在: $RULES_SRC"
else
    # 尝试第一个位置
    if [ -f "$RULES_DST_1" ]; then
        cp "$RULES_DST_1" "$RULES_DST_1.backup"
        echo "[备份] 已备份: $RULES_DST_1.backup"
    fi
    cp "$RULES_SRC" "$RULES_DST_1"
    echo "[OK] 规则已写入: $RULES_DST_1"
    
    # 如果第二个位置的目录存在，也写入那里
    if [ -d "$(dirname "$RULES_DST_2")" ]; then
        if [ -f "$RULES_DST_2" ]; then
            # 追加到现有规则
            echo "" >> "$RULES_DST_2"
            cat "$RULES_SRC" >> "$RULES_DST_2"
            echo "[OK] 规则已追加到: $RULES_DST_2"
        else
            cp "$RULES_SRC" "$RULES_DST_2"
            echo "[OK] 规则已写入: $RULES_DST_2"
        fi
    fi
fi

echo
echo "============================================"
echo "   安装完成！"
echo "============================================"
echo
echo "下一步:"
echo "  [1] 重启 Windsurf"
echo "  [2] 开始对话，AI 完成任务后会自动弹窗"
echo
echo "规则位置:"
echo "  - $RULES_DST_1"
echo "  - $RULES_DST_2 (如果存在)"
echo
echo "MCP 配置: ~/.codeium/windsurf/mcp_config.json"
echo
