#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# 用户安装脚本（无需打包，纯 shell）
#   1. 全局安装 feedback CLI（uv tool → pipx → pip --user）
#   2. 使用 prebuilt .vsix 安装扩展到编辑器
#   3. 同步 Windsurf 扩展目录
#   4. 同步规则模板
#   5. 验证 feedback 命令可用
#
# 用法: bash scripts/install.sh
# ──────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXT_DIR="$ROOT_DIR/apps/extension"
CLI_DIR="$ROOT_DIR/apps/feedback-cli"
PREBUILT="$EXT_DIR/prebuilt/feedback-loop.vsix"
RULES_TEMPLATE="$ROOT_DIR/docs/prompts/templates/windsurf-terminal.txt"
TOTAL=5

# ── 工具函数 ─────────────────────────────────────────────
step() { printf "\n[\033[1;36m%s/%s\033[0m] %s\n" "$1" "$TOTAL" "$2"; }
ok()   { printf "  \033[32m[OK]\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m[警告]\033[0m %s\n" "$1"; }
err()  { printf "  \033[31m[错误]\033[0m %s\n" "$1"; }

get_version() {
  if command -v node &>/dev/null; then
    node -p "require('$EXT_DIR/package.json').version" 2>/dev/null || echo "unknown"
  elif command -v python3 &>/dev/null; then
    python3 -c "import json; print(json.load(open('$EXT_DIR/package.json'))['version'])" 2>/dev/null || echo "unknown"
  else
    grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$EXT_DIR/package.json" | head -1 | grep -o '[0-9][0-9.]*' || echo "unknown"
  fi
}

find_editor_clis() {
  local clis=()
  for cli in \
    "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf" \
    "windsurf" \
    "code"; do
    if command -v "$cli" &>/dev/null || [ -x "$cli" ]; then
      if "$cli" --version &>/dev/null; then
        clis+=("$cli")
      fi
    fi
  done
  printf '%s\n' "${clis[@]}" | awk '!seen[$0]++'
}

# ── 0. 检查 prebuilt ────────────────────────────────────
echo "════════════════════════════════════════════════════════"
echo "  Feedback Loop 用户安装"
echo "════════════════════════════════════════════════════════"

if [ ! -f "$PREBUILT" ]; then
  err "预编译 VSIX 不存在: $PREBUILT"
  echo "  请让开发者先执行 bash scripts/release.sh 生成 prebuilt。"
  exit 1
fi

# ── 1. 全局安装 CLI ─────────────────────────────────────
step 1 "全局安装 feedback CLI..."
CLI_OK=false
if command -v uv &>/dev/null; then
  if uv tool install --force --from "$CLI_DIR" feedback 2>/dev/null; then
    CLI_OK=true
    ok "uv tool install 完成"
  fi
fi
if [ "$CLI_OK" = false ] && command -v pipx &>/dev/null; then
  if pipx install --force "$CLI_DIR" 2>/dev/null; then
    CLI_OK=true
    ok "pipx install 完成"
  fi
fi
if [ "$CLI_OK" = false ] && command -v pip3 &>/dev/null; then
  if pip3 install --user "$CLI_DIR" 2>/dev/null; then
    CLI_OK=true
    ok "pip3 --user 安装完成"
  fi
fi
if [ "$CLI_OK" = false ]; then
  warn "未检测到 uv/pipx/pip3，跳过 CLI 安装"
  warn "请手动安装: pip install $CLI_DIR"
fi

# ── 2. 安装扩展到编辑器 ─────────────────────────────────
step 2 "安装扩展到编辑器..."
EDITORS="$(find_editor_clis)"
if [ -z "$EDITORS" ]; then
  warn "未检测到 windsurf/code CLI，请手动安装: $PREBUILT"
else
  while IFS= read -r cli; do
    printf "  安装到 %s ...\n" "$cli"
    "$cli" --install-extension "$PREBUILT" --force || warn "$cli 安装失败"
  done <<< "$EDITORS"
  ok "编辑器安装完成"
fi

# ── 3. 同步 Windsurf 扩展目录 ───────────────────────────
step 3 "同步 Windsurf 扩展目录..."
VERSION="$(get_version)"
WS_EXT_DIR="$HOME/.windsurf/extensions"
if [ -d "$WS_EXT_DIR" ]; then
  TMPDIR_UNPACK="$HOME/.cache/feedback-loop-vsix-unpack"
  rm -rf "$TMPDIR_UNPACK"
  mkdir -p "$TMPDIR_UNPACK"

  unzip -qo "$PREBUILT" -d "$TMPDIR_UNPACK"

  if [ -d "$TMPDIR_UNPACK/extension" ]; then
    for d in "$WS_EXT_DIR"/peak-xiong.feedback-loop-*; do
      [ -d "$d" ] || continue
      disabled="$WS_EXT_DIR/_disabled.$(basename "$d")"
      rm -rf "$disabled"
      mv "$d" "$disabled"
    done

    TARGET="$WS_EXT_DIR/peak-xiong.feedback-loop-$VERSION"
    rm -rf "$TARGET"
    cp -R "$TMPDIR_UNPACK/extension" "$TARGET"
    ok "已切换到 $TARGET"
  else
    warn "VSIX 解包后未找到 extension 目录"
  fi

  rm -rf "$TMPDIR_UNPACK"
else
  warn "Windsurf 扩展目录不存在，跳过"
fi

# ── 4. 同步规则模板 ─────────────────────────────────────
step 4 "同步规则模板..."
if [ -f "$RULES_TEMPLATE" ]; then
  TARGETS=("$HOME/.windsurfrules")
  GLOBAL_RULES="$HOME/.codeium/windsurf/memories/global_rules.md"
  if [ -d "$(dirname "$GLOBAL_RULES")" ]; then
    TARGETS+=("$GLOBAL_RULES")
  fi

  for target in "${TARGETS[@]}"; do
    if [ -f "$target" ]; then
      cp "$target" "${target}.backup"
      printf "  备份: %s.backup\n" "$target"
    fi
    cp "$RULES_TEMPLATE" "$target"
    ok "写入规则: $target"
  done
else
  warn "模板不存在: $RULES_TEMPLATE"
fi

# ── 5. 验证 ─────────────────────────────────────────────
step 5 "验证 feedback 命令..."
if command -v feedback &>/dev/null; then
  if feedback --help &>/dev/null; then
    ok "feedback 命令可用"
  else
    warn "feedback 命令存在但执行失败"
  fi
else
  warn "feedback 命令不在 PATH 中，可能需要重启终端"
fi

# ── 完成 ────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
printf "  \033[1;32m安装完成！\033[0m\n"
echo "════════════════════════════════════════════════════════"
echo ""
echo "建议重启 Windsurf/VSCode 窗口以加载新版本。"
