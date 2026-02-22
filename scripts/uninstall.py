#!/usr/bin/env python3
"""
Feedback Loop 卸载脚本
- 卸载 VSCode/Windsurf 扩展
- 可选清理当前项目的运行时目录
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
        subprocess.run(
            [cli, "--uninstall-extension", "peak-xiong.feedback-loop", "--force"],
            check=False,
            capture_output=True,
            text=True,
        )
        print("[OK] 已执行扩展卸载命令: peak-xiong.feedback-loop")
    except Exception as e:
        print(f"[警告] 卸载扩展失败: {e}")


def maybe_clean_runtime_data() -> None:
    project_root = Path.cwd().resolve()
    target = project_root / ".windsurf" / "feedback-loop"
    if not target.exists():
        print(f"[跳过] 未找到运行时目录: {target}")
        return
    answer = input(f"是否清理 {target} 运行时数据？(y/N): ").strip().lower()
    if answer in {"y", "yes"}:
        shutil.rmtree(target, ignore_errors=True)
        print(f"[OK] 已清理 {target}")
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
