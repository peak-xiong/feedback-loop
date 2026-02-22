"""
配置常量 - 与 extension 的 config.ts 对应
"""

from pathlib import Path

# 超时配置
DEFAULT_TIMEOUT = 0  # 默认不超时（用户可能在很久之后才输入反馈）


def resolve_project_root(project: str = "") -> Path:
    if project:
        return Path(project).expanduser().resolve()
    return Path.cwd().resolve()


def get_runtime_dirs(project: str = "") -> dict[str, Path]:
    root = resolve_project_root(project)
    base_dir = root / ".windsurf" / "feedback-loop"
    requests_dir = base_dir / "requests"
    return {
        "project_root": root,
        "base_dir": base_dir,
        "requests_dir": requests_dir,
        "pending_dir": requests_dir / "pending",
        "completed_dir": requests_dir / "completed",
        "images_dir": requests_dir / "images",
    }
