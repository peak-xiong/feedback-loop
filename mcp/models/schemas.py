"""
SQLModel schema definitions.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Column, Field, SQLModel, Text


class RequestStatus(str, Enum):
    """Request status values."""
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    TIMEOUT = "TIMEOUT"


class SessionRequest(SQLModel, table=True):
    """Request from MCP to extension."""
    __tablename__ = "session_requests"

    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: str = Field(unique=True, index=True)
    session_id: str = Field(default="", index=True)
    prompt: str = Field(sa_column=Column(Text))
    options: Optional[str] = Field(default=None, sa_column=Column(Text))
    status: RequestStatus = Field(default=RequestStatus.PENDING)
    is_pause: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class SessionResponse(SQLModel, table=True):
    """Response from extension to MCP."""
    __tablename__ = "session_responses"

    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: str = Field(unique=True, index=True)
    response_text: str = Field(default="", sa_column=Column(Text))
    cancelled: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)


class AgentSession(SQLModel, table=True):
    """Agent session identity."""
    __tablename__ = "agent_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    agent_id: str = Field(unique=True, index=True)
    display_name: Optional[str] = Field(default=None)
    context: Optional[str] = Field(default=None, sa_column=Column(Text))
    
    # Model info (AI self-reports)
    model: Optional[str] = Field(default=None)
    credits_spent: Optional[int] = Field(default=0)
    tool_calls: Optional[int] = Field(default=0)
    files_changed: Optional[int] = Field(default=0)
    
    created_at: datetime = Field(default_factory=datetime.now)
    last_activity: datetime = Field(default_factory=datetime.now)
