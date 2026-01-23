#!/usr/bin/env python3
"""
Quick Rename Script
快速重命名工具 - 只需修改 NAME，其他全部自动生成
"""

import json
import os
import re
from pathlib import Path

# =============================================================================
# 只需修改这一个值！
# =============================================================================

NAME = "session-helper"  # 修改这里即可，例如: "dev-helper", "code-pause", "ai-continue"

# =============================================================================
# 自动生成配置（无需修改）
# =============================================================================

def generate_config(name: str) -> dict:
    """根据名称自动生成所有配置"""
    # 分割单词
    words = name.replace("_", "-").split("-")
    
    return {
        # dev-helper -> dev_checkpoint
        "tool_name": f"{words[0]}_checkpoint",
        
        # dev-helper (保持原样)
        "mcp_server_name": name,
        
        # dev-helper -> Dev Helper
        "display_name": " ".join(w.capitalize() for w in words),
        
        # dev-helper (保持原样)
        "extension_id": name,
        
        # dev-helper -> DH
        "status_abbr": "".join(w[0].upper() for w in words),
        
        # dev-helper -> [DH]
        "log_prefix": "[" + "".join(w[0].upper() for w in words) + "]",
    }


# =============================================================================
# 文件更新逻辑
# =============================================================================

def get_project_root() -> Path:
    return Path(__file__).parent.parent.resolve()


def update_server_py(config: dict):
    """更新 server/server.py"""
    root = get_project_root()
    path = root / "server" / "server.py"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    content = path.read_text(encoding="utf-8")
    
    # 更新工具名称
    content = re.sub(
        r'name="[a-z_]+_checkpoint"',
        f'name="{config["tool_name"]}"',
        content
    )
    content = re.sub(
        r'name != "[a-z_]+_checkpoint"',
        f'name != "{config["tool_name"]}"',
        content
    )
    
    # 更新日志前缀 (匹配 [XX] 格式)
    content = re.sub(
        r'\[(?:SH|[A-Z]{2,4})\]',
        config["log_prefix"],
        content
    )
    
    # 更新 MCP 服务器名称
    content = re.sub(
        r'Server\("[^"]+"\)',
        f'Server("{config["mcp_server_name"]}")',
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"[OK] {path}")


def update_setup_py(config: dict):
    """更新 server/setup.py"""
    root = get_project_root()
    path = root / "server" / "setup.py"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    content = path.read_text(encoding="utf-8")
    
    # 更新 MCP 配置键名 (匹配 "xxx-xxx" 格式)
    content = re.sub(
        r'"[a-z]+-[a-z]+"(?=\s*(?:in|:|\]))',
        f'"{config["mcp_server_name"]}"',
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"[OK] {path}")


def update_extension_ts(config: dict):
    """更新 extension/src/extension.ts"""
    root = get_project_root()
    path = root / "extension" / "src" / "extension.ts"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    content = path.read_text(encoding="utf-8")
    
    # 更新类型检查
    content = re.sub(
        r'request\.type === "[a-z_]+"',
        f'request.type === "{config["tool_name"]}"',
        content
    )
    
    # 更新状态栏显示 (匹配 XX: 格式)
    content = re.sub(
        r'(?:SH|[A-Z]{2,4}):',
        f'{config["status_abbr"]}:',
        content
    )
    
    # 更新日志前缀
    content = re.sub(
        r'\[(?:SH|[A-Z]{2,4})\]',
        config["log_prefix"],
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"[OK] {path}")


def update_package_json(config: dict):
    """更新 extension/package.json"""
    root = get_project_root()
    path = root / "extension" / "package.json"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    data = json.loads(path.read_text(encoding="utf-8"))
    
    old_name = data.get("displayName", "Session Helper")
    
    data["name"] = config["extension_id"]
    data["displayName"] = config["display_name"]
    
    # 更新命令标题
    for cmd in data.get("contributes", {}).get("commands", []):
        if "title" in cmd:
            cmd["title"] = cmd["title"].replace(old_name, config["display_name"])
    
    # 更新视图容器标题
    for container in data.get("contributes", {}).get("viewsContainers", {}).get("activitybar", []):
        if "title" in container:
            container["title"] = config["display_name"]
    
    # 更新配置标题
    if "configuration" in data.get("contributes", {}):
        data["contributes"]["configuration"]["title"] = config["display_name"]
    
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[OK] {path}")


def update_rules(config: dict):
    """更新 rules/example-windsurfrules.txt"""
    root = get_project_root()
    path = root / "rules" / "example-windsurfrules.txt"
    
    if not path.exists():
        print(f"[跳过] {path} 不存在")
        return
    
    content = path.read_text(encoding="utf-8")
    
    # 更新工具名称
    content = re.sub(
        r'[a-z]+_checkpoint',
        config["tool_name"],
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"[OK] {path}")


def main():
    config = generate_config(NAME)
    
    print("=" * 50)
    print("  Quick Rename - 快速重命名工具")
    print("=" * 50)
    print()
    print(f"输入名称: {NAME}")
    print()
    print("自动生成配置:")
    for key, value in config.items():
        print(f"  {key}: {value}")
    print()
    print("更新文件:")
    
    update_server_py(config)
    update_setup_py(config)
    update_extension_ts(config)
    update_package_json(config)
    update_rules(config)
    
    print()
    print("=" * 50)
    print("  更新完成！")
    print("=" * 50)
    print()
    print("后续步骤:")
    print("  1. cd extension && npm run compile")
    print("  2. cd extension && npm run package")
    print("  3. 运行 install.bat 重新安装")
    print()


if __name__ == "__main__":
    main()
