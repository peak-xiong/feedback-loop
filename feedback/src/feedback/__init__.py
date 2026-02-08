"""
Feedback - AI 交互式反馈工具

通过文件系统与 VSCode 扩展通信，收集用户反馈。
"""

__version__ = "1.0.0"
__all__ = ["collect_feedback", "FeedbackCollector", "FeedbackResult"]

from .collector import FeedbackCollector, FeedbackResult, collect_feedback

