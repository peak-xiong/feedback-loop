"""
CRUD operations for session management.
"""

import json
import random
import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import col, select

from .database import get_session
from .schemas import SessionRequest, SessionResponse, AgentSession, RequestStatus


# =============================================================================
# Friendly Name Generator
# =============================================================================

ADJECTIVES = [
    "swift", "bright", "calm", "bold", "keen",
    "wise", "dark", "pure", "wild", "cool",
    "warm", "deep", "soft", "sharp", "quick"
]
NOUNS = [
    "wolf", "hawk", "fox", "bear", "lynx",
    "crow", "deer", "owl", "hare", "seal",
    "orca", "raven", "tiger", "lotus", "storm"
]


def generate_friendly_name() -> str:
    """Generate a unique friendly agent name."""
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    suffix = uuid.uuid4().hex[:4]
    return f"{adj}-{noun}-{suffix}"


# =============================================================================
# Request CRUD
# =============================================================================

def save_request(
    request_id: str, 
    prompt: str, 
    options: Optional[list] = None,
    session_id: str = "", 
    is_pause: bool = False
) -> SessionRequest:
    """Save a new request to database."""
    with get_session() as session:
        req = SessionRequest(
            request_id=request_id,
            session_id=session_id or request_id,
            prompt=prompt,
            options=json.dumps(options) if options else None,
            is_pause=is_pause,
        )
        session.add(req)
        session.commit()
        session.refresh(req)
        return req


def save_response(
    request_id: str, 
    response_text: str, 
    cancelled: bool = False
) -> SessionResponse:
    """Save a response to database."""
    with get_session() as session:
        # Update request status
        req = session.exec(
            select(SessionRequest).where(SessionRequest.request_id == request_id)
        ).first()
        if req:
            req.status = RequestStatus.CANCELLED if cancelled else RequestStatus.COMPLETED
            req.updated_at = datetime.now()
            session.add(req)
        
        # Save response
        resp = SessionResponse(
            request_id=request_id,
            response_text=response_text,
            cancelled=cancelled,
        )
        session.add(resp)
        session.commit()
        session.refresh(resp)
        return resp


def update_request_status(request_id: str, status: RequestStatus):
    """Update request status."""
    with get_session() as session:
        req = session.exec(
            select(SessionRequest).where(SessionRequest.request_id == request_id)
        ).first()
        if req:
            req.status = status
            req.updated_at = datetime.now()
            session.add(req)
            session.commit()


def get_pending_requests() -> list[SessionRequest]:
    """Get all pending requests."""
    with get_session() as session:
        results = session.exec(
            select(SessionRequest)
            .where(SessionRequest.status == RequestStatus.PENDING)
            .order_by(col(SessionRequest.created_at).desc())
        ).all()
        return list(results)


def get_recent_sessions(limit: int = 20) -> list[SessionRequest]:
    """Get recent session requests."""
    with get_session() as session:
        results = session.exec(
            select(SessionRequest)
            .order_by(col(SessionRequest.created_at).desc())
            .limit(limit)
        ).all()
        return list(results)


def get_request_by_id(request_id: str) -> Optional[SessionRequest]:
    """Get request by ID."""
    with get_session() as session:
        return session.exec(
            select(SessionRequest).where(SessionRequest.request_id == request_id)
        ).first()


# =============================================================================
# Agent CRUD
# =============================================================================

def create_agent(
    context: Optional[str] = None,
    model: Optional[str] = None,
    credits_spent: int = 0,
    tool_calls: int = 0,
    files_changed: int = 0
) -> AgentSession:
    """Create a new agent session with a friendly name."""
    with get_session() as session:
        agent = AgentSession(
            agent_id=generate_friendly_name(),
            context=context,
            model=model,
            credits_spent=credits_spent,
            tool_calls=tool_calls,
            files_changed=files_changed,
        )
        session.add(agent)
        session.commit()
        session.refresh(agent)
        return agent


def get_agent(agent_id: str) -> Optional[AgentSession]:
    """Get agent by ID."""
    with get_session() as session:
        return session.exec(
            select(AgentSession).where(AgentSession.agent_id == agent_id)
        ).first()


def find_agents_by_context(hints: str, limit: int = 5) -> list[AgentSession]:
    """Find agents matching context hints."""
    with get_session() as session:
        results = session.exec(
            select(AgentSession)
            .where(AgentSession.context.contains(hints))  # type: ignore
            .order_by(col(AgentSession.last_activity).desc())
            .limit(limit)
        ).all()
        return list(results)


def get_all_agents(limit: int = 20) -> list[AgentSession]:
    """Get all active agents."""
    with get_session() as session:
        results = session.exec(
            select(AgentSession)
            .order_by(col(AgentSession.last_activity).desc())
            .limit(limit)
        ).all()
        return list(results)


def update_agent_activity(
    agent_id: str, 
    context: Optional[str] = None
) -> Optional[AgentSession]:
    """Update agent last activity time and optionally context."""
    with get_session() as session:
        agent = session.exec(
            select(AgentSession).where(AgentSession.agent_id == agent_id)
        ).first()
        if agent:
            agent.last_activity = datetime.now()
            if context:
                agent.context = context
            session.add(agent)
            session.commit()
            session.refresh(agent)
        return agent
