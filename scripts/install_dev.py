#!/usr/bin/env python3
"""
开发模式安装脚本：
- 安装本地依赖（CLI + extension）
- 打包 extension 并自动安装到编辑器
- 可选同步规则模板
"""

from __future__ import annotations

import shutil
import sys

from install_helpers import (
    extension_version,
    feedback_dir,
    install_vsix_to_detected_editors,
    package_extension,
    run,
    sync_rules,
    sync_vsix_to_windsurf_extensions,
    vsix_path,
)


def install_cli_dev_deps() -> bool:
    print("[1/4] 安装 CLI 开发依赖...")
    if shutil.which("uv"):
        return run(["uv", "sync"], cwd=feedback_dir())
    print("[提示] 未检测到 uv，使用 pip editable 安装（开发模式）")
    return run([sys.executable, "-m", "pip", "install", "-e", str(feedback_dir())])


def main() -> None:
    print("=" * 56)
    print("Feedback Loop 开发安装（自动部署/更新）")
    print("=" * 56)

    if not install_cli_dev_deps():
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

    version = extension_version()
    sync_vsix_to_windsurf_extensions(vsix, version)

    print("[4/4] 同步规则模板...")
    sync_rules()

    print("\n开发安装完成。建议重启 Windsurf/VSCode 窗口。")


if __name__ == "__main__":
    main()
