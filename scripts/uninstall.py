#!/usr/bin/env python3
"""
Session Helper - 跨平台卸载脚本
"""

import os
import sys
import subprocess
from pathlib import Path

IS_WINDOWS = sys.platform == "win32"


def print_header():
    print("=" * 50)
    print("   Session Helper - 卸载")
    print("=" * 50)
    print()


def get_project_root() -> Path:
    """获取项目根目录（scripts 的父目录）"""
    return Path(__file__).parent.parent.resolve()


def uninstall_extension():
    """卸载扩展"""
    print("[1/2] 卸载 Windsurf 扩展...")
    try:
        subprocess.run(
            ["code", "--uninstall-extension", "peak-xiong.util-io"],
            capture_output=True
        )
        print("[OK] 已尝试卸载扩展")
    except Exception:
        print("[警告] 无法自动卸载扩展")


def remove_mcp_config():
    """移除 MCP 配置"""
    print()
    print("[2/2] 清理 MCP 配置...")
    root = get_project_root()
    setup_script = root / "server" / "setup.py"
    
    if setup_script.exists():
        try:
            subprocess.run([sys.executable, str(setup_script), "--uninstall"], check=True)
        except subprocess.CalledProcessError:
            print("[警告] MCP 配置清理可能未完成")


def print_success():
    print()
    print("=" * 50)
    print("   卸载完成！")
    print("=" * 50)
    print()


def main():
    print_header()
    uninstall_extension()
    remove_mcp_config()
    print_success()
    
    if IS_WINDOWS:
        input("按 Enter 退出...")


if __name__ == "__main__":
    main()
