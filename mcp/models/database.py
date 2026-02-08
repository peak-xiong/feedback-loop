"""
Database connection and session management.
"""

from pathlib import Path
from sqlmodel import create_engine, Session

# Database location
DB_PATH = Path.home() / ".session-helper" / "sessions.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine
engine = create_engine(DATABASE_URL, echo=False)


def get_session():
    """Get database session."""
    return Session(engine)


def init_db():
    """Create all tables."""
    from sqlmodel import SQLModel
    SQLModel.metadata.create_all(engine)
