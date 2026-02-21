"""
反馈收集器 - 通过文件系统与 VSCode 扩展通信
"""

import json
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from datetime import datetime

from .config import PENDING_DIR, COMPLETED_DIR, DEFAULT_TIMEOUT


@dataclass
class FeedbackResult:
    """反馈结果"""
    content: str = ""
    images: list[str] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    success: bool = True
    # 元数据
    model: str = ""
    session_id: str = ""
    title: str = ""
    agent_id: str = ""

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "images": self.images,
            "timestamp": self.timestamp,
            "success": self.success,
            "model": self.model,
            "sessionId": self.session_id,
            "title": self.title,
            "agentId": self.agent_id,
        }


class FeedbackCollector:
    """反馈收集器 - 阻塞等待扩展响应"""

    def __init__(
        self,
        project: str = "",
        summary: str = "",
        session_id: Optional[str] = None,
        model: Optional[str] = None,
        title: Optional[str] = None,
        options: Optional[list] = None,
        timeout: Optional[int] = None,
    ):
        self.project = project or str(Path.cwd())
        self.summary = summary
        self.session_id = session_id
        self.model = model
        self.title = title
        self.options = options or []
        self.timeout = timeout if timeout is not None else DEFAULT_TIMEOUT
        self.request_id = str(uuid.uuid4())
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        """确保目录存在"""
        PENDING_DIR.mkdir(parents=True, exist_ok=True)
        COMPLETED_DIR.mkdir(parents=True, exist_ok=True)

    def collect(self) -> FeedbackResult:
        """收集反馈（阻塞等待）"""
        self._print_header()
        self._write_request()

        response = self._wait_for_response()
        self._cleanup()

        if response:
            self._print_success()
            return FeedbackResult(
                content=response.get("content", ""),
                images=response.get("images", []),
                model=response.get("model", ""),
                session_id=response.get("sessionId", ""),
                title=response.get("title", ""),
                agent_id=response.get("agentId", ""),
            )
        else:
            self._print_timeout()
            return FeedbackResult(success=False)

    def _print_header(self) -> None:
        """打印头部信息"""
        short_id = self.request_id[:8]
        print(f"\n🤖 等待反馈 [{short_id}] 请在 IDE 扩展中提交", flush=True)

    def _write_request(self) -> None:
        """写入请求文件"""
        request_file = PENDING_DIR / f"{self.request_id}.json"
        request_data = {
            "id": self.request_id,
            "project": self.project,
            "summary": self.summary,
            "createdAt": datetime.now().isoformat(),
            "sessionId": self.session_id,
            "model": self.model,
            "title": self.title,
            "options": self.options,
        }
        request_file.write_text(
            json.dumps(request_data, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    def _wait_for_response(self) -> Optional[dict]:
        """轮询等待响应"""
        response_file = COMPLETED_DIR / f"{self.request_id}.json"
        poll_interval = 0.5
        start_time = time.time()

        try:
            while True:
                if response_file.exists():
                    print()  # 换行
                    return json.loads(response_file.read_text(encoding="utf-8"))

                # 超时保护
                if self.timeout > 0 and (time.time() - start_time) > self.timeout:
                    return None

                time.sleep(poll_interval)

        except KeyboardInterrupt:
            print("\n⚠️ 已取消")
            return None

    def _cleanup(self) -> None:
        """清理文件"""
        for file in [
            PENDING_DIR / f"{self.request_id}.json",
            COMPLETED_DIR / f"{self.request_id}.json",
        ]:
            try:
                file.unlink(missing_ok=True)
            except Exception:
                pass

    def _print_success(self) -> None:
        print("✅ 已收到反馈")

    def _print_timeout(self) -> None:
        print("⏰ 超时")


def collect_feedback(
    project: str = "",
    summary: str = "",
    session_id: Optional[str] = None,
    model: Optional[str] = None,
    title: Optional[str] = None,
    options: Optional[list] = None,
    timeout: Optional[int] = None,
) -> FeedbackResult:
    """
    收集用户反馈的便捷函数

    Args:
        project: 项目目录路径
        summary: AI 工作摘要
        session_id: 会话 ID
        model: 模型名称
        title: 对话标题
        options: 快捷选项列表
        timeout: 超时秒数（默认 30 分钟，0 = 永不超时）

    Returns:
        FeedbackResult 对象
    """
    collector = FeedbackCollector(
        project=project,
        summary=summary,
        session_id=session_id,
        model=model,
        title=title,
        options=options,
        timeout=timeout,
    )
    return collector.collect()
