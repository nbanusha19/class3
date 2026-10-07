from flask import Blueprint

from controllers import (
    auth_controller,
    coc_controller,
    health_controller,
    lock_controller,
    report_controller,
    workload_controller,
)

health_bp = Blueprint("health", __name__, url_prefix="/api")
health_bp.add_url_rule("/health", view_func=health_controller.health, methods=["GET"])

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
auth_bp.add_url_rule("/login", view_func=auth_controller.login, methods=["POST"])
auth_bp.add_url_rule("/refresh", view_func=auth_controller.refresh, methods=["POST"])
auth_bp.add_url_rule("/me", view_func=auth_controller.me, methods=["GET"])

coc_bp = Blueprint("coc", __name__, url_prefix="/api/coc")
coc_bp.add_url_rule("/lookup", view_func=coc_controller.lookup, methods=["POST", "GET"])
coc_bp.add_url_rule("/drill-info", view_func=coc_controller.drill_info, methods=["POST", "GET"])

workload_bp = Blueprint("workload", __name__, url_prefix="/api")
workload_bp.add_url_rule("/workload", view_func=workload_controller.list_workload, methods=["GET"])

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")
reports_bp.add_url_rule("", view_func=report_controller.list_reports, methods=["GET"])
reports_bp.add_url_rule("", view_func=report_controller.create_report, methods=["POST"])
reports_bp.add_url_rule("/<report_id>", view_func=report_controller.get_report, methods=["GET"])
reports_bp.add_url_rule("/<report_id>", view_func=report_controller.update_report, methods=["PUT"])
reports_bp.add_url_rule("/<report_id>", view_func=report_controller.delete_report, methods=["DELETE"])
reports_bp.add_url_rule("/<report_id>/files", view_func=report_controller.upload_report_file, methods=["POST"])
locks_bp = Blueprint("report_locks", __name__, url_prefix="/api/report-locks")
locks_bp.add_url_rule("/acquire", view_func=lock_controller.acquire, methods=["POST"])
locks_bp.add_url_rule("/heartbeat", view_func=lock_controller.heartbeat, methods=["POST"])
locks_bp.add_url_rule("/release", view_func=lock_controller.release, methods=["POST"])
reports_bp.add_url_rule(
    "/<report_id>/files/<file_id>",
    view_func=report_controller.download_report_file,
    methods=["GET"],
)
reports_bp.add_url_rule(
    "/<report_id>/files/<file_id>",
    view_func=report_controller.delete_report_file,
    methods=["DELETE"],
)


def register_blueprints(app):
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(coc_bp)
    app.register_blueprint(workload_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(locks_bp)
