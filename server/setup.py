#!/usr/bin/env python3
"""
MCP 配置安装脚本
安全地将 session-helper 配置合并到现有的 mcp_config.json 中
自动使用虚拟环境的 Python
"""

import json
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime


def get_project_root() -> Path:
    """获取项目根目录"""
    return Path(__file__).parent.parent.resolve()


def get_venv_python() -> str:
    """获取虚拟环境 Python 路径"""
    # 优先使用环境变量（由 install.py 传递）
    if "VENV_PYTHON" in os.environ:
        return os.environ["VENV_PYTHON"]
    
    # 否则构建路径
    root = get_project_root()
    if sys.platform == "win32":
        venv_python = root / ".venv" / "Scripts" / "python.exe"
    else:
        venv_python = root / ".venv" / "bin" / "python"
    
    if venv_python.exists():
        return str(venv_python)
    
    # 回退到系统 Python
    return "python" if sys.platform == "win32" else "python3"


def get_mcp_config_path() -> Path:
    """获取 Windsurf MCP 配置文件路径"""
    home = Path.home()
    return home / ".codeium" / "windsurf" / "mcp_config.json"


def get_server_path() -> str:
    """获取 server.py 的绝对路径（使用正斜杠）"""
    script_dir = Path(__file__).parent.resolve()
    server_path = script_dir / "server.py"
    return str(server_path).replace("\\", "/")


def backup_config(config_path: Path):
    """备份现有配置文件"""
    if config_path.exists():
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = config_path.with_suffix(f".backup_{timestamp}.json")
        shutil.copy2(config_path, backup_path)
        print(f"[备份] 已备份原配置到: {backup_path}")
        return backup_path
    return None


def load_existing_config(config_path: Path) -> dict:
    """加载现有配置"""
    if not config_path.exists():
        return {"mcpServers": {}}
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return {"mcpServers": {}}
            config = json.loads(content)
            if "mcpServers" not in config:
                config["mcpServers"] = {}
            return config
    except json.JSONDecodeError as e:
        print(f"[警告] 配置文件 JSON 格式无效: {e}")
        return {"mcpServers": {}}
    except Exception as e:
        print(f"[警告] 读取配置文件失败: {e}")
        return {"mcpServers": {}}


def install_mcp_config():
    """安装/更新 MCP 配置"""
    config_path = get_mcp_config_path()
    server_path = get_server_path()
    venv_python = get_venv_python()
    
    print(f"[信息] MCP 配置路径: {config_path}")
    print(f"[信息] Server 路径: {server_path}")
    print(f"[信息] Python 路径: {venv_python}")
    
    # 确保目录存在
    config_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 备份现有配置
    backup_config(config_path)
    
    # 加载现有配置
    config = load_existing_config(config_path)
    
    if "util-io" in config["mcpServers"]:
        print("[信息] 检测到已有 util-io 配置，将更新")
    
    # 添加/更新配置（使用虚拟环境 Python）
    config["mcpServers"]["util-io"] = {
        "command": venv_python,
        "args": [server_path]
    }
    
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print(f"[OK] MCP 配置已更新: {config_path}")
        
        servers = list(config["mcpServers"].keys())
        print(f"[信息] 当前已配置的 MCP 服务器: {', '.join(servers)}")
        return True
    except Exception as e:
        print(f"[错误] 写入配置失败: {e}")
        return False


def uninstall_mcp_config():
    """卸载 session-helper 配置"""
    config_path = get_mcp_config_path()
    
    if not config_path.exists():
        print("[信息] 配置文件不存在，无需卸载")
        return True
    
    backup_config(config_path)
    config = load_existing_config(config_path)
    
    if "util-io" in config["mcpServers"]:
        del config["mcpServers"]["util-io"]
        print("[OK] 已移除 util-io 配置")
    else:
        print("[信息] util-io 配置不存在")
    
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        servers = list(config["mcpServers"].keys())
        if servers:
            print(f"[信息] 保留的 MCP 服务器: {', '.join(servers)}")
        else:
            print("[信息] 当前无其他 MCP 服务器配置")
        return True
    except Exception as e:
        print(f"[错误] 写入配置失败: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--uninstall":
        success = uninstall_mcp_config()
    else:
        success = install_mcp_config()
    
    sys.exit(0 if success else 1)
