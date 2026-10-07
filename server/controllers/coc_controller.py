from flask import jsonify, request
from flask_jwt_extended import jwt_required

from services.coc_service import fetch_coc_by_production_order
from services.drill_service import fetch_drill_info


def _production_order_from_request() -> str:
    body = request.get_json(silent=True) or {}
    return str(
        body.get("productionOrderNumber")
        or body.get("productionOrder")
        or body.get("travNumber")
        or body.get("travnumber")
        or body.get("cocNumber")
        or request.args.get("productionOrderNumber")
        or request.args.get("productionOrder")
        or request.args.get("cocNumber")
        or ""
    )


@jwt_required()
def lookup():
    body = request.get_json(silent=True) or {}
    production_order = _production_order_from_request()
    coc_date = str(body.get("cocDate") or body.get("date") or request.args.get("cocDate") or "")

    data, error = fetch_coc_by_production_order(production_order, coc_date or None)
    if error:
        status = 404 if "not found" in error.lower() or "no traveler" in error.lower() else 400
        if "database error" in error.lower() or "not configured" in error.lower():
            status = 503
        return jsonify({"error": error}), status

    return jsonify({"coc": data})


@jwt_required()
def drill_info():
    production_order = _production_order_from_request()
    data, error = fetch_drill_info(production_order)
    if error:
        status = 404 if "not found" in error.lower() or "no traveler" in error.lower() else 400
        if "database error" in error.lower() or "not configured" in error.lower():
            status = 503
        return jsonify({"error": error}), status

    return jsonify(data)
