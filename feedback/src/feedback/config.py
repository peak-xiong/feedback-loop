"""
配置常量 - 与 extension 的 config.ts 对应
"""

from pathlib import Path


# 共享目录配置（与 VSCode 扩展保持一致）
BASE_DIR = Path.home() / ".session-helper"
REQUESTS_DIR = BASE_DIR / "requests"
PENDING_DIR = REQUESTS_DIR / "pending"
COMPLETED_DIR = REQUESTS_DIR / "completed"
IMAGES_DIR = REQUESTS_DIR / "images"

# 超时配置
DEFAULT_TIMEOUT = 0  # 默认不超时（用户可能在很久之后才输入反馈）
