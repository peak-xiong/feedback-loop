#!/usr/bin/env python3
"""
用户安装脚本：
- 全局安装 feedback CLI（优先 uv tool，其次 pipx，最后 pip --user）
- 打包并安装 extension
- 同步规则模板
"""

from __future__ import annotations

import shutil
import subprocess
import sys

from install_helpers import (
    feedback_dir,
    install_vsix_to_detected_editors,
    package_extension,
    run,
    sync_rules,
    sync_vsix_to_windsurf_extensions,
    extension_version,
    vsix_path,
)


def install_cli_global() -> bool:
    print("[1/4] 全局安装 feedback CLI...")
    src = str(feedback_dir())

    if shutil.which("uv"):
        # uv tool install --from <path> <script-name>
        if run(["uv", "tool", "install", "--force", "--from", src, "feedback"]):
            return True

    if shutil.which("pipx"):
        if run(["pipx", "install", "--force", src]):
            return True

    print("[提示] 回退到 pip --user 安装")
    return run([sys.executable, "-m", "pip", "install", "--user", src])


def verify_feedback_available() -> None:
    try:
        result = subprocess.run(
            ["feedback", "--help"], check=False, capture_output=True, text=True
        )
        if result.returncode != 0:
            print("[错误] feedback 命令校验失败（返回码非 0）")
            sys.exit(1)
        print("[OK] feedback 命令可用")
    except Exception as e:
        print(f"[错误] feedback 命令不可用: {e}")
        sys.exit(1)


def main() -> None:
    print("=" * 56)
    print("Feedback Loop 用户安装（CLI 全局 + Extension）")
    print("=" * 56)

    if not install_cli_global():
        sys.exit(1)

    print("[2/4] 打包扩展...")
    if not package_extension():
        sys.exit(1)

    vsix = vsix_path()
    if not vsix.exists():
        print(f"[错误] 未找到 VSIX: {vsix}")
        sys.exit(1)

    print("[3/4] 安装扩展到编辑器...")
    install_vsix_to_detected_editors(vsix)
    sync_vsix_to_windsurf_extensions(vsix, extension_version())

    print("[4/4] 同步规则模板...")
    sync_rules()
    verify_feedback_available()

    print("\n用户安装完成。建议重启 Windsurf/VSCode 窗口。")


if __name__ == "__main__":
    main()
