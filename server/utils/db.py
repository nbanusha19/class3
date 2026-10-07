from sqlalchemy import create_engine

_engine = None


def init_db_engine(uri: str | None) -> None:
    """Initialize the read-only TrackingKannan engine. Never call create_all / migrate."""
    global _engine
    if not uri:
        _engine = None
        return
    _engine = create_engine(
        uri,
        pool_pre_ping=True,
        pool_recycle=3600,
        future=True,
    )


def get_db_engine():
    return _engine
