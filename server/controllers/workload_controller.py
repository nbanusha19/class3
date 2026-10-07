from flask import jsonify, request
from flask_jwt_extended import jwt_required

from services import workload_service


@jwt_required()
def list_workload():
    overdue = str(request.args.get("overdueFirst") or "").strip().lower() in {"1", "true", "yes"}
    result = workload_service.list_workload(
        stage=request.args.get("stage") or "wip",
        search=request.args.get("search") or request.args.get("q"),
        customer=request.args.get("customer"),
        overdue_first=overdue,
        page=request.args.get("page", default=1, type=int),
        page_size=request.args.get("pageSize", default=10, type=int),
        sort_by=request.args.get("sortBy") or "received",
        sort_dir=request.args.get("sortDir") or "desc",
    )
    return jsonify(result)
