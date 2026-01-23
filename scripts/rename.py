#!/usr/bin/env python3
"""
Quick Rename Script
快速重命名工具 - 当名称被屏蔽时，修改 config 后运行此脚本即可更新所有位置
"""

import json
import os
import re
from pathlib import Path

# =============================================================================
# 配置 - 修改这里的值即可更换名称
# =============================================================================

CONFIG = {
    # MCP 工具名称（AI 调用的工具名，下划线格式）
    "tool_name": "session_checkpoint",
    
    # MCP 服务器名称（mcp_config.json 中的 key，连字符格式）
    "mcp_server_name": "session-helper",
    
    # 扩展显示名称
    "display_name": "Session Helper",
    
    # 扩展 ID 前缀（package.json 中的 name）
    "extension_id": "session-helper",
    
    # 状态栏缩写
    "status_abbr": "SH",
    
    # 日志前缀
    "log_prefix": "[SH]",
}

# =============================================================================
# 文件更新逻辑
# =============================================================================

def get_project_root() -> Path:
    """获取项目根目录"""
    return Path(__file__).parent.parent.resolve()


def update_server_py():
    """更新 server/server.py"""
    root = get_project_root()
    path = root / "server" / "server.py"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    content = path.read_text(encoding="utf-8")
    
    # 更新工具名称
    content = re.sub(
        r'name="[^"]+_checkpoint"',
        f'name="{CONFIG["tool_name"]}"',
        content
    )
    
    # 更新日志前缀
    content = re.sub(
        r'\[SH\]',
        CONFIG["log_prefix"],
        content
    )
    
    # 更新 MCP 服务器名称
    content = re.sub(
        r'Server\("[^"]+"\)',
        f'Server("{CONFIG["mcp_server_name"]}")',
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"[OK] 已更新 {path}")


def update_setup_py():
    """更新 server/setup.py"""
    root = get_project_root()
    path = root / "server" / "setup.py"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    content = path.read_text(encoding="utf-8")
    
    # 更新 MCP 配置键名
    content = re.sub(
        r'"session-helper"',
        f'"{CONFIG["mcp_server_name"]}"',
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"[OK] 已更新 {path}")


def update_extension_ts():
    """更新 extension/src/extension.ts"""
    root = get_project_root()
    path = root / "extension" / "src" / "extension.ts"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    content = path.read_text(encoding="utf-8")
    
    # 更新 session_checkpoint 类型检查
    content = re.sub(
        r'request\.type === "[^"]+"',
        f'request.type === "{CONFIG["tool_name"]}"',
        content
    )
    
    # 更新状态栏显示
    content = re.sub(
        r'SH:',
        f'{CONFIG["status_abbr"]}:',
        content
    )
    
    # 更新日志前缀
    content = re.sub(
        r'\[SH\]',
        CONFIG["log_prefix"],
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"[OK] 已更新 {path}")


def update_package_json():
    """更新 extension/package.json"""
    root = get_project_root()
    path = root / "extension" / "package.json"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    data = json.loads(path.read_text(encoding="utf-8"))
    
    data["name"] = CONFIG["extension_id"]
    data["displayName"] = CONFIG["display_name"]
    
    # 更新命令标题
    for cmd in data.get("contributes", {}).get("commands", []):
        if "title" in cmd:
            cmd["title"] = re.sub(
                r'^[^:]+:',
                f'{CONFIG["display_name"]}:',
                cmd["title"]
            )
    
    # 更新配置标题
    if "configuration" in data.get("contributes", {}):
        data["contributes"]["configuration"]["title"] = CONFIG["display_name"]
    
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[OK] 已更新 {path}")


def update_rules():
    """更新 rules/example-windsurfrules.txt"""
    root = get_project_root()
    path = root / "rules" / "example-windsurfrules.txt"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    content = path.read_text(encoding="utf-8")
    
    # 更新工具名称
    content = re.sub(
        r'session_checkpoint',
        CONFIG["tool_name"],
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"[OK] 已更新 {path}")


def main():
    print("=" * 50)
    print("  Quick Rename - 快速重命名工具")
    print("=" * 50)
    print()
    print("当前配置:")
    for key, value in CONFIG.items():
        print(f"  {key}: {value}")
    print()
    
    update_server_py()
    update_setup_py()
    update_extension_ts()
    update_package_json()
    update_rules()
    
    print()
    print("=" * 50)
    print("  更新完成！")
    print("=" * 50)
    print()
    print("后续步骤:")
    print("  1. cd extension && npm run compile")
    print("  2. cd extension && npm run package")
    print("  3. 重新安装扩展")
    print()


if __name__ == "__main__":
    main()
