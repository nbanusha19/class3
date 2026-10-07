from flask import jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from models.coc_report import CocReport
from services.report_lock_service import (
    acquire_locks,
    heartbeat_locks,
    production_orders_from_payload,
    release_locks,
    report_production_orders,
)


def _actor() -> tuple[str, str]:
    claims = get_jwt() or {}
    uid = str(claims.get("uid") or get_jwt_identity() or "").strip()
    name = str(claims.get("name") or uid).strip()
    return uid, name


@jwt_required()
def acquire():
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        body = {}

    payload = body.get("payload")
    if isinstance(payload, dict):
        orders = production_orders_from_payload(payload)
    else:
        orders = body.get("productionOrders")
        if not isinstance(orders, list):
            orders = [body.get("productionOrder")] if body.get("productionOrder") else []

    report_id = str(body.get("reportId") or "").strip()
    if report_id:
        report = CocReport.query.filter_by(id=report_id, is_deleted=False).first()
        if not report:
            return jsonify({"error": "Report not found."}), 404
        orders = report_production_orders(report)

    uid, name = _actor()
    if not uid:
        return jsonify({"error": "Authenticated user is missing from the token."}), 401

    acquired, error = acquire_locks(orders, uid, name)
    if error:
        status = 409 if "already being used" in error or "Unable to acquire" in error else 400
        return jsonify({"error": error}), status
    return jsonify({"productionOrders": acquired}), 200


@jwt_required()
def heartbeat():
    body = request.get_json(silent=True) or {}
    orders = body.get("productionOrders")
    if not isinstance(orders, list):
        orders = [body.get("productionOrder")] if body.get("productionOrder") else []
    uid, _name = _actor()
    if not uid:
        return jsonify({"error": "Authenticated user is missing from the token."}), 401
    if not heartbeat_locks(orders, uid):
        return jsonify({"error": "The editing lock expired or is no longer owned by you."}), 409
    return jsonify({"success": True}), 200


@jwt_required()
def release():
    body = request.get_json(silent=True) or {}
    orders = body.get("productionOrders")
    if not isinstance(orders, list):
        orders = [body.get("productionOrder")] if body.get("productionOrder") else []
    uid, _name = _actor()
    if not uid:
        return jsonify({"error": "Authenticated user is missing from the token."}), 401
    release_locks(orders, uid)
    return jsonify({"success": True}), 200
