"""
命令行入口
"""

import sys
import json
import argparse

from .collector import collect_feedback


def main():
    """CLI 入口"""
    parser = argparse.ArgumentParser(
        prog="feedback",
        description="AI 交互式反馈工具",
    )
    
    parser.add_argument(
        "-p", "--project",
        type=str,
        default="",
        help="项目目录路径",
    )
    parser.add_argument(
        "-s", "--summary",
        type=str,
        default="",
        help="AI 工作摘要",
    )
    parser.add_argument(
        "--session-id",
        type=str,
        help="会话 ID（关联同一对话）",
    )
    parser.add_argument(
        "--model",
        type=str,
        help="模型名称",
    )
    parser.add_argument(
        "--title",
        type=str,
        help="对话标题",
    )
    parser.add_argument(
        "--options",
        type=str,
        help="快捷选项（逗号分隔，如 '继续,重试,取消'）",
    )
    
    args = parser.parse_args()
    
    # 解析 options
    options = None
    if args.options:
        options = [opt.strip() for opt in args.options.split(",") if opt.strip()]
    
    try:
        result = collect_feedback(
            project=args.project,
            summary=args.summary,
            session_id=args.session_id,
            model=args.model,
            title=args.title,
            options=options,
        )
        
        print(f"\n📝 反馈内容:\n{result.content}")
        
        # 输出 JSON 供 AI 解析
        print("\n--- FEEDBACK_JSON ---")
        print(json.dumps(result.to_dict(), ensure_ascii=False))
        print("--- END_FEEDBACK ---")
        
    except KeyboardInterrupt:
        print("\n⚠️ 已取消")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 错误: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
