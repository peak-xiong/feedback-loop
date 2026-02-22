#!/usr/bin/env python3
"""
Installer shared helpers.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import zipfile
from pathlib import Path


HOME = Path.home()


def project_root() -> Path:
    return Path(__file__).parent.parent.resolve()


def feedback_dir() -> Path:
    return project_root() / "apps" / "feedback-cli"


def extension_dir() -> Path:
    return project_root() / "apps" / "extension"


def rules_template() -> Path:
    return project_root() / "docs" / "prompts" / "templates" / "windsurf-terminal.txt"


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> bool:
    try:
        subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=check)
        return True
    except Exception as e:
        print(f"[错误] 命令失败: {' '.join(cmd)}")
        print(f"      {e}")
        return False


def find_editor_clis() -> list[str]:
    candidates = [
        "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf",
        "windsurf",
        "code",
    ]
    found: list[str] = []
    for cli in candidates:
        try:
            result = subprocess.run(
                [cli, "--version"], capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                found.append(cli)
        except Exception:
            continue
    # Deduplicate while preserving order
    unique: list[str] = []
    seen: set[str] = set()
    for cli in found:
        if cli in seen:
            continue
        seen.add(cli)
        unique.append(cli)
    return unique


def package_extension() -> bool:
    if not run(["npm", "install"], cwd=extension_dir()):
        return False
    return run(["npm", "run", "package"], cwd=extension_dir())


def extension_package_json() -> dict:
    p = extension_dir() / "package.json"
    return json.loads(p.read_text(encoding="utf-8"))


def extension_version() -> str:
    return str(extension_package_json().get("version", "")).strip()


def vsix_path() -> Path:
    return extension_dir() / "dist" / "feedback-loop.vsix"


def install_vsix_to_detected_editors(vsix: Path) -> bool:
    clis = find_editor_clis()
    if not clis:
        print("[警告] 未检测到 windsurf/code CLI，请手动安装 VSIX：")
        print(f"       {vsix}")
        return False
    ok = True
    for cli in clis:
        print(f"[安装扩展] {cli}")
        ok = run([cli, "--install-extension", str(vsix), "--force"], check=False) and ok
    return ok


def sync_rules() -> bool:
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


def sync_vsix_to_windsurf_extensions(vsix: Path, version: str) -> bool:
    ws_extensions = HOME / ".windsurf" / "extensions"
    if not ws_extensions.exists():
        # Windsurf may not be installed or never launched.
        return False

    temp_dir = HOME / ".cache" / "feedback-loop-vsix-unpack"
    try:
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
        temp_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(vsix, "r") as zf:
            zf.extractall(temp_dir)

        src_extension = temp_dir / "extension"
        if not src_extension.exists():
            print("[警告] VSIX 解包后未找到 extension 目录")
            return False

        # Disable all active versions
        for d in ws_extensions.glob("peak-xiong.feedback-loop-*"):
            if d.is_dir():
                disabled = ws_extensions / f"_disabled.{d.name}"
                if disabled.exists():
                    shutil.rmtree(disabled, ignore_errors=True)
                d.rename(disabled)

        target = ws_extensions / f"peak-xiong.feedback-loop-{version}"
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(src_extension, target)
        print(f"[OK] Windsurf 目录已切换到: {target}")
        return True
    except Exception as e:
        print(f"[警告] 同步 Windsurf 扩展目录失败: {e}")
        return False
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
