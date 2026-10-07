from sqlalchemy import create_engine

_hiq_engine = None


def init_hiq_engine(uri: str | None) -> None:
    """Initialize the read-only HIQ engine. Never call create_all / migrate."""
    global _hiq_engine
    if not uri:
        _hiq_engine = None
        return
    _hiq_engine = create_engine(
        uri,
        pool_pre_ping=True,
        pool_recycle=3600,
        future=True,
    )


def get_hiq_engine():
    return _hiq_engine
