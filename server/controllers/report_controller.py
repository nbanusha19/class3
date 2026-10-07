from flask import jsonify, request, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from services import file_service, report_service
from services.report_lock_service import (
    production_order_lock_conflict,
    production_orders_from_payload,
    report_production_orders,
    report_lock_conflict,
)


def _actor():
    claims = get_jwt() or {}
    return {
        "user_id": str(get_jwt_identity() or ""),
        "uid": str(claims.get("uid") or ""),
        "name": str(claims.get("name") or ""),
    }


@jwt_required()
def list_reports():
    result = report_service.list_reports(
        search=request.args.get("search") or request.args.get("q"),
        page=request.args.get("page", default=1, type=int),
        page_size=request.args.get("pageSize", default=10, type=int),
        sort_by=request.args.get("sortBy") or "updatedAt",
        sort_dir=request.args.get("sortDir") or "desc",
    )
    return jsonify(
        {
            "reports": [row.to_summary() for row in result["reports"]],
            "pagination": result["pagination"],
            "stats": result["stats"],
            "sort": result["sort"],
            "search": result["search"],
        }
    )


@jwt_required()
def get_report(report_id: str):
    report, error = report_service.get_report(report_id)
    if error or not report:
        return jsonify({"error": error or "Report not found."}), 404
    conflict = report_lock_conflict(report, str(get_jwt().get("uid") or ""))
    if conflict:
        return jsonify({"error": conflict}), 409
    return jsonify({"report": report.to_dict()})


@jwt_required()
def create_report():
    body = request.get_json(silent=True) or {}
    payload = body.get("payload")
    if payload is None:
        payload = body
    actor = _actor()
    conflict = production_order_lock_conflict(
        production_orders_from_payload(payload if isinstance(payload, dict) else {}),
        actor["uid"],
    )
    if conflict:
        return jsonify({"error": conflict}), 409
    report, error = report_service.create_report(
        payload if isinstance(payload, dict) else {},
        user_id=actor["user_id"],
        uid=actor["uid"],
        name=actor["name"],
        status=str(body.get("status") or "in-progress"),
    )
    if error or not report:
        return jsonify({"error": error or "Unable to save report."}), 400
    return jsonify({"report": report.to_dict()}), 201


@jwt_required()
def update_report(report_id: str):
    body = request.get_json(silent=True) or {}
    payload = body.get("payload")
    if not isinstance(payload, dict):
        return jsonify({"error": "payload is required."}), 400

    actor = _actor()
    existing, existing_error = report_service.get_report(report_id)
    if existing_error or not existing:
        return jsonify({"error": existing_error or "Report not found."}), 404

    old_keys = set(report_production_orders(existing))
    new_keys = set(production_orders_from_payload(payload))
    old_orders = {key for key in old_keys if key.startswith("PO:")}
    new_orders = {key for key in new_keys if key.startswith("PO:")}

    if (existing.status or "").lower() in {"verification", "approved"} and old_orders != new_orders:
        return jsonify(
            {"error": "This production order is not editable in Verification or Approved."}
        ), 409

    if old_keys != new_keys:
        return jsonify(
            {"error": "The report production order or COC cannot be changed while editing. Reopen the intended job."}
        ), 409

    conflict = production_order_lock_conflict(sorted(new_keys), actor["uid"])
    if conflict:
        return jsonify({"error": conflict}), 409

    conflict = report_lock_conflict(existing, actor["uid"])
    if conflict:
        return jsonify({"error": conflict}), 409
    report, error = report_service.update_report(
        report_id,
        payload if isinstance(payload, dict) else {},
        uid=actor["uid"],
        status=str(body.get("status") or "") or None,
    )
    if error or not report:
        status = 404 if error and "not found" in error.lower() else 400
        return jsonify({"error": error or "Unable to update report."}), status
    return jsonify({"report": report.to_dict()})


@jwt_required()
def delete_report(report_id: str):
    if not get_jwt().get("isAdmin"):
        return jsonify({"error": "Admin permission is required to delete reports."}), 403
    actor = _actor()
    ok, error = report_service.soft_delete_report(report_id, uid=actor["uid"])
    if not ok:
        return jsonify({"error": error or "Unable to delete report."}), 404
    return jsonify({"success": True})


@jwt_required()
def upload_report_file(report_id: str):
    storage = request.files.get("file")
    if storage is None:
        return jsonify({"error": "file is required."}), 400
    actor = _actor()
    rec, error = file_service.save_report_file(
        report_id,
        storage,
        form=str(request.form.get("form") or "f3"),
        row_sl=str(request.form.get("rowSl") or request.form.get("row") or ""),
        uid=actor["uid"],
    )
    if error or not rec:
        status = 404 if error and "not found" in error.lower() else 400
        return jsonify({"error": error or "Unable to upload file."}), status
    return jsonify({"file": rec.to_dict()}), 201


@jwt_required()
def download_report_file(report_id: str, file_id: str):
    rec, error = file_service.get_file(report_id, file_id)
    if error or not rec:
        status = 404 if error and "not found" in error.lower() else 400
        return jsonify({"error": error or "File not found."}), status
    try:
        disk = file_service.file_disk_path(rec)
    except ValueError:
        return jsonify({"error": "File not found."}), 404
    if not disk.is_file():
        return jsonify({"error": "File is missing on disk."}), 404
    return send_file(
        disk,
        as_attachment=False,
        download_name=rec.original_name,
        mimetype=rec.mime_type or None,
    )


@jwt_required()
def delete_report_file(report_id: str, file_id: str):
    ok, error = file_service.delete_report_file(report_id, file_id)
    if not ok:
        status = 404 if error and "not found" in error.lower() else 400
        return jsonify({"error": error or "Unable to delete file."}), status
    return jsonify({"success": True})
