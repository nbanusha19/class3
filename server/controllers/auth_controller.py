from flask import jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity, jwt_required

from middlewares.auth import get_current_user
from services.auth_service import authenticate_user, get_user_by_id


def _token_claims(user) -> dict:
    return {
        "uid": user.uid,
        "name": user.user_name,
        "role": user.role,
        "isAdmin": user.is_admin,
        "roleId": user.role_id,
        "email": user.email_id,
    }


def login():
    from flask import request

    body = request.get_json(silent=True) or {}
    uid = str(body.get("uid") or body.get("userId") or "")
    password = str(body.get("password") or "")

    user, error = authenticate_user(uid, password)
    if error:
        return jsonify({"error": error}), 401

    identity = str(user.user_id)
    claims = _token_claims(user)
    access_token = create_access_token(identity=identity, additional_claims=claims)
    refresh_token = create_refresh_token(identity=identity, additional_claims=claims)

    return jsonify(
        {
            "token": access_token,
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "user": user.to_dict(),
        }
    )


@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    user, error = get_user_by_id(identity)
    if error or not user:
        return jsonify({"error": error or "User not found."}), 401

    access_token = create_access_token(identity=str(user.user_id), additional_claims=_token_claims(user))
    return jsonify({"token": access_token, "accessToken": access_token})


@jwt_required()
def me():
    identity = get_jwt_identity()
    user, error = get_user_by_id(identity)
    if error or not user:
        # Fall back to JWT claims if the DB is briefly unavailable after login.
        claimed = get_current_user(refresh_from_db=False)
        if claimed:
            return jsonify({"user": claimed.to_dict()})
        return jsonify({"error": error or "User not found."}), 401

    return jsonify({"user": user.to_dict()})
