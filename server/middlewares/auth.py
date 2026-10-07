from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from models.user import TrackingUser
from services.auth_service import get_user_by_id


def user_from_claims(claims: dict | None = None, identity: str | None = None) -> TrackingUser | None:
    claims = claims or {}
    uid = str(claims.get("uid") or "").strip()
    if not uid or identity is None:
        return None

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None

    return TrackingUser(
        user_id=user_id,
        uid=uid,
        user_name=str(claims.get("name") or uid).strip(),
        user_active=True,
        is_admin=bool(claims.get("isAdmin")),
        role_id=claims.get("roleId"),
        email_id=str(claims.get("email") or "").strip(),
    )


def get_current_user(refresh_from_db: bool = False) -> TrackingUser | None:
    identity = get_jwt_identity()
    claims = get_jwt()
    if refresh_from_db and identity is not None:
        user, _error = get_user_by_id(identity)
        return user
    return user_from_claims(claims, identity)


def jwt_required_custom(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required."}), 401
        return fn(*args, **kwargs)

    return wrapper
