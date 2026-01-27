#!/usr/bin/env python3
"""
Quick Rename & Reinstall Script
一键重命名并重新安装 - 支持随机名称生成或自定义名称

Usage:
    python quick_rename.py              # 使用随机名称
    python quick_rename.py dev-helper   # 使用自定义名称
    python quick_rename.py --random     # 强制使用随机名称
"""

import json
import os
import random
import re
import string
import subprocess
import sys
from pathlib import Path

# =============================================================================
# 随机名称生成器
# =============================================================================

# 常用词汇表（看起来正常的词）
PREFIXES = [
    "dev", "code", "work", "task", "flow", "io", "util", "tool",
    "core", "base", "smart", "quick", "fast", "auto", "pro", "lite",
    "mini", "micro", "nano", "meta", "hyper", "super", "ultra", "mega",
]

SUFFIXES = [
    "helper", "assist", "buddy", "mate", "hub", "lab", "box", "kit",
    "space", "zone", "dock", "port", "link", "io", "flow", "wave",
    "pulse", "spark", "glow", "dash", "rush", "jump", "leap", "step",
]

# 混淆词汇表（看起来像乱码但其实是有意义的）
OBFUSCATED_PREFIXES = [
    "xdev", "qcode", "zutil", "kflow", "jwork", "vbase", "wcore", "yfast",
    "hpro", "dkit", "bsync", "fsmart", "gquick", "lauto", "msync", "nflow",
]

OBFUSCATED_SUFFIXES = [
    "hlpr", "asst", "budx", "matx", "hubx", "labz", "boxq", "kitz",
    "spcx", "zonx", "dckx", "prtx", "lnkx", "sncx", "flwx", "wavx",
]


def generate_random_name(obfuscate: bool = False) -> str:
    """生成随机名称"""
    if obfuscate:
        # 混淆模式：使用类似乱码的名称
        prefix = random.choice(OBFUSCATED_PREFIXES)
        suffix = random.choice(OBFUSCATED_SUFFIXES)
        # 可选：添加随机数字
        if random.random() > 0.5:
            suffix += str(random.randint(1, 99))
    else:
        # 正常模式：使用常见词汇
        prefix = random.choice(PREFIXES)
        suffix = random.choice(SUFFIXES)
    
    return f"{prefix}-{suffix}"


def generate_hash_name(length: int = 8) -> str:
    """生成类似哈希的名称"""
    chars = string.ascii_lowercase + string.digits
    hash_part = ''.join(random.choice(chars) for _ in range(length))
    return f"x{hash_part[:4]}-{hash_part[4:]}"


# =============================================================================
# 配置生成
# =============================================================================

def generate_config(name: str) -> dict:
    """根据名称自动生成所有配置"""
    words = name.replace("_", "-").split("-")
    abbr = "".join(w[0].upper() for w in words if w)
    
    # 确保缩写至少有2个字符
    if len(abbr) < 2:
        abbr = name[:2].upper()
    
    return {
        "tool_name": f"{words[0]}_checkpoint",
        "mcp_server_name": name,
        "display_name": " ".join(w.capitalize() for w in words),
        "extension_id": name,
        "status_abbr": abbr,
        "log_prefix": f"[{abbr}]",
        "port_dir": f"{abbr.lower()}-ports",
    }


# =============================================================================
# 文件更新逻辑
# =============================================================================

def get_project_root() -> Path:
    return Path(__file__).parent.parent.resolve()


def update_server_py(config: dict) -> bool:
    """更新 server/server.py"""
    root = get_project_root()
    path = root / "server" / "server.py"
    
    if not path.exists():
        print(f"  [跳过] {path.name} 不存在")
        return False
    
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
    
    # 更新日志前缀
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
    
    # 更新端口文件目录名
    content = re.sub(
        r'"[a-z0-9]+-ports"',
        f'"{config["port_dir"]}"',
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"  [OK] {path.name}")
    return True


def update_setup_py(config: dict) -> bool:
    """更新 server/setup.py"""
    root = get_project_root()
    path = root / "server" / "setup.py"
    
    if not path.exists():
        print(f"  [跳过] {path.name} 不存在")
        return False
    
    content = path.read_text(encoding="utf-8")
    
    # 更新 MCP 配置键名
    content = re.sub(
        r'"[a-z0-9]+-[a-z0-9]+"(?=\s*(?:in|:|\]))',
        f'"{config["mcp_server_name"]}"',
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"  [OK] {path.name}")
    return True


def update_extension_ts(config: dict) -> bool:
    """更新 extension/src/extension.ts"""
    root = get_project_root()
    path = root / "extension" / "src" / "extension.ts"
    
    if not path.exists():
        print(f"  [跳过] {path.name} 不存在")
        return False
    
    content = path.read_text(encoding="utf-8")
    
    # 更新类型检查
    content = re.sub(
        r'request\.type === "[a-z_]+"',
        f'request.type === "{config["tool_name"]}"',
        content
    )
    
    # 更新状态栏显示
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
    
    # 更新端口文件目录名
    content = re.sub(
        r'"[a-z0-9]+-ports"',
        f'"{config["port_dir"]}"',
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"  [OK] {path.name}")
    return True


def update_package_json(config: dict) -> bool:
    """更新 extension/package.json"""
    root = get_project_root()
    path = root / "extension" / "package.json"
    
    if not path.exists():
        print(f"  [跳过] {path.name} 不存在")
        return False
    
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
    print(f"  [OK] {path.name}")
    return True


def update_rules(config: dict) -> bool:
    """更新 rules/example-windsurfrules.txt"""
    root = get_project_root()
    path = root / "rules" / "example-windsurfrules.txt"
    
    if not path.exists():
        print(f"  [跳过] {path.name} 不存在")
        return False
    
    content = path.read_text(encoding="utf-8")
    
    # 更新工具名称
    content = re.sub(
        r'[a-z]+_checkpoint',
        config["tool_name"],
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"  [OK] {path.name}")
    return True


def update_global_rules(config: dict) -> bool:
    """更新全局 global_rules.md"""
    path = Path.home() / ".codeium" / "windsurf" / "memories" / "global_rules.md"
    
    if not path.exists():
        print(f"  [跳过] {path.name} 不存在")
        return False
    
    content = path.read_text(encoding="utf-8")
    
    # 更新工具名称
    content = re.sub(
        r'[a-z]+_checkpoint',
        config["tool_name"],
        content
    )
    
    path.write_text(content, encoding="utf-8")
    print(f"  [OK] {path.name} (全局规则)")
    return True


# =============================================================================
# MCP 配置更新
# =============================================================================

def update_mcp_config(config: dict, old_name: str | None = None) -> bool:
    """更新 MCP 配置文件 - 只保留 mcp-router 和新的重命名 MCP"""
    mcp_path = Path.home() / ".codeium" / "windsurf" / "mcp_config.json"
    
    if not mcp_path.exists():
        print("  [跳过] MCP 配置不存在")
        return False
    
    mcp_data = json.loads(mcp_path.read_text(encoding="utf-8"))
    servers = mcp_data.get("mcpServers", {})
    
    root = get_project_root()
    server_path = str(root / "server" / "server.py")
    python_path = str(root / ".venv" / "bin" / "python")
    
    # 保存 mcp-router 配置
    mcp_router_config = servers.get("mcp-router")
    
    # 清空所有配置，只保留需要的
    new_servers = {}
    
    # 恢复 mcp-router
    if mcp_router_config:
        new_servers["mcp-router"] = mcp_router_config
        print("  [保留] mcp-router")
    
    # 添加新的重命名 MCP
    new_servers[config["mcp_server_name"]] = {
        "command": python_path,
        "args": [server_path]
    }
    print(f"  [添加] {config['mcp_server_name']}")
    
    # 显示已删除的配置
    removed = set(servers.keys()) - set(new_servers.keys())
    for name in removed:
        print(f"  [删除] {name}")
    
    mcp_data["mcpServers"] = new_servers
    mcp_path.write_text(json.dumps(mcp_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("  [OK] MCP 配置已更新")
    return True


# =============================================================================
# 构建和安装
# =============================================================================

def run_command(cmd: list, cwd: Path = None) -> tuple[bool, str]:
    """执行命令并返回结果"""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=120
        )
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)


def build_extension() -> bool:
    """编译和打包扩展"""
    root = get_project_root()
    ext_dir = root / "extension"
    
    print("\n[3/5] 编译扩展...")
    success, output = run_command(["npm", "run", "compile"], cwd=ext_dir)
    if not success:
        print(f"  [失败] 编译错误: {output}")
        return False
    print("  [OK] 编译完成")
    
    print("\n[4/5] 打包扩展...")
    # 使用 yes 命令自动确认
    success, output = run_command(["bash", "-c", "yes | npm run package"], cwd=ext_dir)
    if not success and "successfully" not in output.lower():
        print(f"  [失败] 打包错误: {output}")
        return False
    print("  [OK] 打包完成")
    
    return True


def install_extension(config: dict) -> bool:
    """安装扩展到 Windsurf"""
    root = get_project_root()
    ext_dir = root / "extension"
    
    # 查找最新的 vsix 文件
    vsix_pattern = f"{config['extension_id']}-*.vsix"
    vsix_files = list(ext_dir.glob(vsix_pattern))
    
    if not vsix_files:
        print(f"  [失败] 未找到 VSIX 文件: {vsix_pattern}")
        return False
    
    vsix_file = max(vsix_files, key=lambda p: p.stat().st_mtime)
    
    print(f"\n[5/5] 安装扩展: {vsix_file.name}")
    success, output = run_command(["windsurf", "--install-extension", str(vsix_file)])
    if not success:
        print(f"  [失败] 安装错误: {output}")
        return False
    print("  [OK] 安装完成")
    
    return True


# =============================================================================
# 主程序
# =============================================================================

def get_current_name() -> str:
    """获取当前配置的名称"""
    root = get_project_root()
    pkg_path = root / "extension" / "package.json"
    
    if pkg_path.exists():
        data = json.loads(pkg_path.read_text(encoding="utf-8"))
        return data.get("name", "session-helper")
    
    return "session-helper"


def main():
    # 解析参数
    args = sys.argv[1:]
    
    # 显示帮助
    if "--help" in args or "-h" in args:
        print(__doc__)
        print("Options:")
        print("  --random      使用随机正常名称 (默认)")
        print("  --obfuscate   使用混淆名称 (类似乱码)")
        print("  --hash        使用哈希风格名称")
        print("  <name>        使用自定义名称 (格式: xxx-xxx)")
        print()
        print("Examples:")
        print("  python quick_rename.py")
        print("  python quick_rename.py dev-helper")
        print("  python quick_rename.py --obfuscate")
        print("  python quick_rename.py --hash")
        sys.exit(0)
    
    # 确定新名称
    if not args or args[0] == "--random":
        new_name = generate_random_name(obfuscate=False)
    elif args[0] == "--obfuscate":
        new_name = generate_random_name(obfuscate=True)
    elif args[0] == "--hash":
        new_name = generate_hash_name()
    elif args[0].startswith("--"):
        print(f"未知选项: {args[0]}")
        print("使用 --help 查看帮助")
        sys.exit(1)
    else:
        new_name = args[0]
    
    old_name = get_current_name()
    config = generate_config(new_name)
    
    print("=" * 60)
    print("  Quick Rename & Reinstall - 一键重命名并安装")
    print("=" * 60)
    print()
    print(f"  当前名称: {old_name}")
    print(f"  新名称:   {new_name}")
    print()
    print("  生成配置:")
    for key, value in config.items():
        print(f"    {key}: {value}")
    print()
    
    # Step 1: 更新文件
    print("[1/5] 更新源代码文件...")
    update_server_py(config)
    update_setup_py(config)
    update_extension_ts(config)
    update_package_json(config)
    update_rules(config)
    
    # Step 2: 更新全局规则和 MCP 配置
    print("\n[2/5] 更新配置文件...")
    update_global_rules(config)
    update_mcp_config(config, old_name)
    
    # Step 3-4: 构建
    if not build_extension():
        print("\n[错误] 构建失败，请检查错误信息")
        sys.exit(1)
    
    # Step 5: 安装
    if not install_extension(config):
        print("\n[错误] 安装失败，请检查错误信息")
        sys.exit(1)
    
    print()
    print("=" * 60)
    print("  ✅ 全部完成！")
    print("=" * 60)
    print()
    print("  工具名称:   ", config["tool_name"])
    print("  MCP 服务器: ", config["mcp_server_name"])
    print()
    print("  请重启 Windsurf 以使更改生效")
    print()


if __name__ == "__main__":
    main()
