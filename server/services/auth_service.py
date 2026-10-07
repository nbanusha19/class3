from sqlalchemy import text

from models.user import TrackingUser
from utils.db import get_db_engine

LOGIN_SQL = """
SELECT TOP 1
    UserID,
    UID,
    UserName,
    UserPassword,
    UserActive,
    IsAdmin,
    RoleID,
    EmailID
FROM dbo.[User]
WHERE LTRIM(RTRIM(UID)) = :uid
  AND LTRIM(RTRIM(UserPassword)) = :password
"""

USER_BY_ID_SQL = """
SELECT TOP 1
    UserID,
    UID,
    UserName,
    UserPassword,
    UserActive,
    IsAdmin,
    RoleID,
    EmailID
FROM dbo.[User]
WHERE UserID = :user_id
"""


def authenticate_user(uid: str, password: str) -> tuple[TrackingUser | None, str | None]:
    uid = (uid or "").strip()
    password = password or ""
    if not uid or not password:
        return None, "Enter your user ID and password."

    engine = get_db_engine()
    if engine is None:
        return None, "Database is not configured."

    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(LOGIN_SQL),
                {"uid": uid, "password": password},
            ).mappings().first()
    except Exception as exc:
        return None, f"Database error: {exc}"

    if not row:
        return None, "Invalid user ID or password."

    user = TrackingUser.from_row(row)
    if not user.user_active:
        return None, "User account is inactive."

    return user, None


def get_user_by_id(user_id: int | str) -> tuple[TrackingUser | None, str | None]:
    try:
        parsed_id = int(user_id)
    except (TypeError, ValueError):
        return None, "Invalid user identity."

    engine = get_db_engine()
    if engine is None:
        return None, "Database is not configured."

    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(USER_BY_ID_SQL),
                {"user_id": parsed_id},
            ).mappings().first()
    except Exception as exc:
        return None, f"Database error: {exc}"

    if not row:
        return None, "User not found."

    user = TrackingUser.from_row(row)
    if not user.user_active:
        return None, "User account is inactive."

    return user, None
