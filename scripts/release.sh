#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# 开发者一键发布脚本
#   1. 安装 CLI 开发依赖
#   2. 安装 Extension 依赖
#   3. 打包 Extension（自动 bump patch 版本号）
#   4. 同步 .vsix 到 prebuilt 目录（入库供用户直接安装）
#   5. 安装扩展到本地编辑器（Windsurf / VSCode）
#   6. 同步 Windsurf 扩展目录
#   7. 同步规则模板
#
# 用法: bash scripts/release.sh
# ──────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXT_DIR="$ROOT_DIR/apps/extension"
CLI_DIR="$ROOT_DIR/apps/feedback-cli"
PREBUILT="$EXT_DIR/prebuilt/feedback-loop.vsix"
VSIX="$EXT_DIR/dist/feedback-loop.vsix"
RULES_TEMPLATE="$ROOT_DIR/docs/prompts/templates/windsurf-terminal.txt"
TOTAL=7

# ── 工具函数 ─────────────────────────────────────────────
step() { printf "\n[\033[1;36m%s/%s\033[0m] %s\n" "$1" "$TOTAL" "$2"; }
ok()   { printf "  \033[32m[OK]\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m[警告]\033[0m %s\n" "$1"; }
err()  { printf "  \033[31m[错误]\033[0m %s\n" "$1"; }

get_version() {
  node -p "require('$EXT_DIR/package.json').version" 2>/dev/null || echo "unknown"
}

# 检测可用的编辑器 CLI
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
  # 去重
  printf '%s\n' "${clis[@]}" | awk '!seen[$0]++'
}

# ── 1. CLI 开发依赖 ─────────────────────────────────────
step 1 "安装 CLI 开发依赖..."
if command -v uv &>/dev/null; then
  (cd "$CLI_DIR" && uv sync)
  ok "uv sync 完成"
elif command -v pip3 &>/dev/null; then
  pip3 install -e "$CLI_DIR"
  ok "pip3 editable 安装完成"
else
  warn "未检测到 uv 或 pip3，跳过 CLI 依赖安装"
fi

# ── 2. Extension 依赖 ───────────────────────────────────
step 2 "安装 Extension 依赖..."
(cd "$EXT_DIR" && npm install)
ok "npm install 完成"

# ── 3. 打包 Extension ───────────────────────────────────
step 3 "打包 Extension（bump patch + compile + vsce package）..."
(cd "$EXT_DIR" && npm run package)
if [ ! -f "$VSIX" ]; then
  err "未找到 VSIX: $VSIX"
  exit 1
fi
VERSION="$(get_version)"
ok "打包完成 v$VERSION → $VSIX"

# ── 4. 同步到 prebuilt ──────────────────────────────────
step 4 "同步 .vsix 到 prebuilt 目录..."
mkdir -p "$(dirname "$PREBUILT")"
cp -f "$VSIX" "$PREBUILT"
ok "$PREBUILT"

# ── 5. 安装到编辑器 ─────────────────────────────────────
step 5 "安装扩展到编辑器..."
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

# ── 6. 同步 Windsurf 扩展目录 ───────────────────────────
step 6 "同步 Windsurf 扩展目录..."
WS_EXT_DIR="$HOME/.windsurf/extensions"
if [ -d "$WS_EXT_DIR" ]; then
  TMPDIR_UNPACK="$HOME/.cache/feedback-loop-vsix-unpack"
  rm -rf "$TMPDIR_UNPACK"
  mkdir -p "$TMPDIR_UNPACK"

  unzip -qo "$PREBUILT" -d "$TMPDIR_UNPACK"

  if [ -d "$TMPDIR_UNPACK/extension" ]; then
    # 禁用旧版本
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

# ── 7. 同步规则模板 ─────────────────────────────────────
step 7 "同步规则模板..."
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

# ── 完成 ────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
printf "  \033[1;32m版本 v%s 发布完成！\033[0m\n" "$VERSION"
echo "════════════════════════════════════════════════════════"
echo ""
echo "建议执行："
echo "  git add -A && git commit -m \"release: v$VERSION\""
echo ""
echo "建议重启 Windsurf/VSCode 窗口以加载新版本。"
