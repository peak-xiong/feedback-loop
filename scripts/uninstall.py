#!/usr/bin/env python3
"""
Feedback Loop 卸载脚本
- 卸载 VSCode/Windsurf 扩展
- 可选清理本地请求目录
"""

import shutil
import subprocess
from pathlib import Path


def find_editor_cli() -> str | None:
    candidates = [
        "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf",
        "windsurf",
        "code",
    ]
    for cli in candidates:
        try:
            result = subprocess.run(
                [cli, "--version"], capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                return cli
        except Exception:
            continue
    return None


def uninstall_extension() -> None:
    cli = find_editor_cli()
    if not cli:
        print("[警告] 未找到 windsurf/code CLI，跳过自动卸载扩展")
        return
    try:
        # 卸载旧/新两个扩展 ID（忽略失败）
        for ext in ("peak-xiong.io-util", "peak-xiong.feedback-loop"):
            subprocess.run(
                [cli, "--uninstall-extension", ext, "--force"],
                check=False,
                capture_output=True,
                text=True,
            )
            print(f"[OK] 已执行扩展卸载命令: {ext}")
    except Exception as e:
        print(f"[警告] 卸载扩展失败: {e}")


def maybe_clean_runtime_data() -> None:
    target = Path.home() / ".feedback-loop"
    if not target.exists():
        return
    answer = input("是否清理 ~/.feedback-loop 运行时数据？(y/N): ").strip().lower()
    if answer in {"y", "yes"}:
        shutil.rmtree(target, ignore_errors=True)
        print("[OK] 已清理 ~/.feedback-loop")
    else:
        print("[跳过] 保留运行时数据")


def main() -> None:
    print("=" * 40)
    print("Feedback Loop 卸载")
    print("=" * 40)
    uninstall_extension()
    maybe_clean_runtime_data()
    print("完成。")


if __name__ == "__main__":
    main()
