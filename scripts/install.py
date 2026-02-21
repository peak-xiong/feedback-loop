#!/usr/bin/env python3
"""
Feedback Loop 安装脚本（当前主链路）
- 安装 feedback CLI 依赖
- 构建并打包 extension
- 安装 VSIX 到 VSCode/Windsurf
- 同步规则模板到全局规则文件
"""

import shutil
import subprocess
import sys
from pathlib import Path


IS_WINDOWS = sys.platform == "win32"
HOME = Path.home()


def project_root() -> Path:
    return Path(__file__).parent.parent.resolve()


def feedback_dir() -> Path:
    return project_root() / "apps" / "feedback-cli"


def extension_dir() -> Path:
    return project_root() / "apps" / "extension"


def rules_template() -> Path:
    return project_root() / "docs" / "prompts" / "templates" / "windsurf-terminal.txt"


def run(cmd: list[str], cwd: Path | None = None) -> bool:
    try:
        subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=True)
        return True
    except Exception as e:
        print(f"[错误] 命令失败: {' '.join(cmd)}")
        print(f"      {e}")
        return False


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


def install_feedback_cli() -> bool:
    print("[1/4] 安装 feedback CLI 依赖...")
    if shutil.which("uv"):
        return run(["uv", "sync"], cwd=feedback_dir())
    print("[提示] 未检测到 uv，使用 pip editable 安装")
    return run(
        [sys.executable, "-m", "pip", "install", "-e", str(feedback_dir())],
        cwd=project_root(),
    )


def package_extension() -> bool:
    print("[2/4] 构建并打包 extension...")
    if not run(["npm", "install"], cwd=extension_dir()):
        return False
    return run(["npm", "run", "package"], cwd=extension_dir())


def install_extension() -> bool:
    print("[3/4] 安装扩展...")
    vsix = extension_dir() / "dist" / "io-util.vsix"
    if not vsix.exists():
        print(f"[错误] 未找到 VSIX: {vsix}")
        return False
    cli = find_editor_cli()
    if not cli:
        print("[警告] 未检测到 windsurf/code CLI，请手动安装 VSIX：")
        print(f"       {vsix}")
        return False
    return run([cli, "--install-extension", str(vsix), "--force"])


def sync_rules() -> bool:
    print("[4/4] 同步规则模板...")
    src = rules_template()
    if not src.exists():
        print(f"[警告] 模板不存在: {src}")
        return False
    content = src.read_text(encoding="utf-8")

    targets = [HOME / ".windsurfrules"]
    global_rules = HOME / ".codeium" / "windsurf" / "memories" / "global_rules.md"
    if global_rules.parent.exists():
        targets.append(global_rules)

    for target in targets:
        try:
            if target.exists():
                backup = target.with_suffix(target.suffix + ".backup")
                shutil.copy2(target, backup)
                print(f"[备份] {backup}")
            target.write_text(content, encoding="utf-8")
            print(f"[OK] 写入规则: {target}")
        except Exception as e:
            print(f"[警告] 写入失败 {target}: {e}")
    return True


def main() -> None:
    print("=" * 56)
    print("Feedback Loop 安装（CLI ↔ Extension 文件协议）")
    print("=" * 56)

    if not install_feedback_cli():
        sys.exit(1)
    if not package_extension():
        sys.exit(1)
    install_extension()
    sync_rules()

    print("\n安装完成。建议重启 Windsurf/VSCode 窗口。")


if __name__ == "__main__":
    main()
