#!/usr/bin/env python3
"""
Session Helper - 跨平台安装脚本
自动检测操作系统，创建虚拟环境，执行安装流程
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

# =============================================================================
# 平台检测
# =============================================================================

IS_WINDOWS = sys.platform == "win32"
IS_MACOS = sys.platform == "darwin"
HOME = Path.home()


def print_header():
    print("=" * 50)
    print("   Session Helper - MCP 工具")
    print(f"   平台: {'Windows' if IS_WINDOWS else 'macOS/Linux'}")
    print("=" * 50)
    print()


def get_project_root() -> Path:
    """获取项目根目录（scripts 的父目录）"""
    return Path(__file__).parent.parent.resolve()


def get_venv_dir() -> Path:
    """获取虚拟环境目录"""
    return get_project_root() / ".venv"


def get_venv_python() -> Path:
    """获取虚拟环境中的 Python 路径"""
    venv = get_venv_dir()
    if IS_WINDOWS:
        return venv / "Scripts" / "python.exe"
    else:
        return venv / "bin" / "python"


# =============================================================================
# 安装步骤
# =============================================================================

def check_python():
    """检查 Python 环境"""
    print("[1/6] 检查 Python 环境...")
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 10):
        print(f"[错误] Python 版本过低: {sys.version}")
        print("请安装 Python 3.10+")
        return False
    print(f"[OK] Python {version.major}.{version.minor}.{version.micro}")
    return True


def create_venv():
    """创建虚拟环境"""
    print()
    print("[2/6] 创建虚拟环境...")
    venv_dir = get_venv_dir()
    venv_python = get_venv_python()
    
    if venv_python.exists():
        print(f"[OK] 虚拟环境已存在: {venv_dir}")
        return True
    
    try:
        subprocess.run(
            [sys.executable, "-m", "venv", str(venv_dir)],
            check=True
        )
        print(f"[OK] 虚拟环境已创建: {venv_dir}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[错误] 创建虚拟环境失败: {e}")
        return False


def install_dependencies():
    """安装 Python 依赖到虚拟环境"""
    print()
    print("[3/6] 安装 MCP Server 依赖...")
    root = get_project_root()
    requirements = root / "server" / "requirements.txt"
    venv_python = get_venv_python()
    
    if not requirements.exists():
        print(f"[错误] 找不到 requirements.txt: {requirements}")
        return False
    
    try:
        subprocess.run(
            [str(venv_python), "-m", "pip", "install", "-r", str(requirements), "-q", "--upgrade"],
            check=True
        )
        print("[OK] 依赖安装完成")
        return True
    except subprocess.CalledProcessError as e:
        print(f"[错误] 依赖安装失败: {e}")
        return False


def configure_mcp():
    """配置 MCP（使用虚拟环境的 Python）"""
    print()
    print("[4/6] 配置 MCP...")
    root = get_project_root()
    setup_script = root / "server" / "setup.py"
    venv_python = get_venv_python()
    
    if not setup_script.exists():
        print(f"[错误] 找不到 setup.py: {setup_script}")
        return False
    
    # 传递虚拟环境 Python 路径给 setup.py
    env = os.environ.copy()
    env["VENV_PYTHON"] = str(venv_python)
    
    try:
        subprocess.run([sys.executable, str(setup_script)], check=True, env=env)
        return True
    except subprocess.CalledProcessError as e:
        print(f"[错误] MCP 配置失败: {e}")
        return False


def install_extension():
    """自动安装扩展（先卸载旧版本）"""
    print()
    print("[5/6] 安装 Windsurf 扩展...")
    root = get_project_root()
    vsix = root / "extension" / "dist" / "io-util.vsix"
    
    if not vsix.exists():
        print(f"[警告] 未找到插件包: {vsix}")
        print("       请先编译: cd extension && npm run package")
        return False
    
    print(f"[信息] 找到扩展包: {vsix.name}")
    
    # 获取 CLI 路径
    if IS_WINDOWS:
        cli_paths = ["windsurf", "code"]
    else:
        cli_paths = [
            "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf",
            "code",
            "windsurf",
        ]
    
    # 找到可用的 CLI
    cli = None
    for path in cli_paths:
        try:
            result = subprocess.run([path, "--version"], capture_output=True, timeout=5)
            if result.returncode == 0:
                cli = path
                break
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    
    if not cli:
        print("[警告] 未找到 Windsurf/VS Code CLI")
        print(f"       请手动安装: {vsix}")
        return False
    
    # 卸载旧版本扩展
    old_extensions = [
        "peak-xiong.auto-rush",
        "peak-xiong.dev-pause", 
        "peak-xiong.session-helper",
        "peak-xiong.ask-continue",
        "peak-xiong.tool-sync",
        "peak-xiong.util-io",
    ]
    for ext in old_extensions:
        try:
            result = subprocess.run(
                [cli, "--uninstall-extension", ext, "--force"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                print(f"[清理] 已卸载旧扩展: {ext}")
        except Exception:
            pass
    
    # 清理旧端口目录
    import tempfile
    temp_dir = tempfile.gettempdir()
    old_port_dirs = ["---ports", "ask-continue-ports", "dp-ports", "sh-ports"]
    for dir_name in old_port_dirs:
        dir_path = Path(temp_dir) / dir_name
        if dir_path.exists():
            try:
                shutil.rmtree(dir_path)
                print(f"[清理] 已删除旧端口目录: {dir_name}")
            except Exception:
                pass
    
    # 安装新扩展
    try:
        result = subprocess.run(
            [cli, "--install-extension", str(vsix), "--force"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            print("[OK] 扩展安装成功")
            return True
    except Exception as e:
        print(f"[错误] 安装失败: {e}")
    
    print("[警告] 自动安装失败，请手动安装:")
    print(f"       1. {'Ctrl' if IS_WINDOWS else 'Cmd'}+Shift+P")
    print("       2. 输入: Extensions: Install from VSIX")
    print(f"       3. 选择: {vsix}")
    return False


def configure_rules():
    """配置全局规则"""
    print()
    print("[6/6] 配置全局规则...")
    root = get_project_root()
    rules_src = root / "prompts" / "templates" / "windsurf.txt"
    
    if not rules_src.exists():
        print(f"[警告] 规则文件不存在: {rules_src}")
        return
    
    rules_content = rules_src.read_text(encoding="utf-8")
    
    # 规则文件目标位置
    targets = []
    
    if IS_WINDOWS:
        targets.append(HOME / ".windsurfrules")
    else:
        targets.append(HOME / ".windsurfrules")
        codeium_rules = HOME / ".codeium" / "windsurf" / "memories" / "global_rules.md"
        if codeium_rules.parent.exists():
            targets.append(codeium_rules)
    
    for target in targets:
        try:
            if target.exists():
                backup = target.with_suffix(target.suffix + ".backup")
                shutil.copy2(target, backup)
                print(f"[备份] {backup}")
            
            # 统一使用覆盖模式写入
            target.write_text(rules_content, encoding="utf-8")
            print(f"[OK] 规则已写入: {target}")
        except Exception as e:
            print(f"[警告] 无法写入 {target}: {e}")


def print_success():
    print()
    print("=" * 50)
    print("   安装完成！")
    print("=" * 50)
    print()
    print("下一步:")
    print("  [1] 重启 Windsurf")
    print("  [2] 开始对话，AI 完成任务后会自动弹窗")
    print()
    print(f"虚拟环境: {get_venv_dir()}")
    print()


def main():
    print_header()
    
    if not check_python():
        input("按 Enter 退出...")
        sys.exit(1)
    
    if not create_venv():
        input("按 Enter 退出...")
        sys.exit(1)
    
    if not install_dependencies():
        input("按 Enter 退出...")
        sys.exit(1)
    
    if not configure_mcp():
        input("按 Enter 退出...")
        sys.exit(1)
    
    install_extension()
    configure_rules()
    print_success()
    
    if IS_WINDOWS:
        input("按 Enter 退出...")


if __name__ == "__main__":
    main()
