from __future__ import annotations

from sqlalchemy import asc, desc, func, or_

from extensions import db
from models.coc_report import CocReport, utcnow

SORTABLE = {
    "cocNumber": CocReport.coc_number,
    "productionOrder": CocReport.production_order,
    "customer": CocReport.customer,
    "partNumber": CocReport.part_number,
    "cocDate": CocReport.coc_date,
    "updatedAt": CocReport.updated_at,
    "createdAt": CocReport.created_at,
    "createdByName": CocReport.created_by_name,
    "pcbSuiteType": CocReport.pcb_suite_type,
}


def _clean(value: object | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _summary_from_payload(payload: dict) -> dict[str, str]:
    shared = payload.get("shared") if isinstance(payload.get("shared"), dict) else {}
    fields = payload.get("fields") if isinstance(payload.get("fields"), dict) else {}
    return {
        "production_order": _clean(fields.get("f1.productionOrder") or shared.get("productionOrder")),
        "coc_number": _clean(shared.get("cocNumber")),
        "coc_date": _clean(shared.get("cocDate")),
        "customer": _clean(shared.get("customer")),
        "customer_address": _clean(shared.get("customerAddress")),
        "part_number": _clean(shared.get("partNumber")),
        "po_number": _clean(shared.get("poNumber")),
        "specification": _clean(shared.get("specification")),
        "regulatory_requirement": _clean(shared.get("regulatoryRequirement")),
        "pcb_suite_type": _clean(payload.get("pcbSuiteType") or "rigid") or "rigid",
    }


def _pcb_stats() -> dict[str, int]:
    rows = (
        db.session.query(CocReport.pcb_suite_type, func.count(CocReport.id))
        .filter(CocReport.is_deleted == False)  # noqa: E712 — MSSQL bit column
        .group_by(CocReport.pcb_suite_type)
        .all()
    )
    rigid = flex = rigid_flex = 0
    total = 0
    for suite_type, count in rows:
        key = _clean(suite_type).lower().replace("_", "-")
        total += int(count or 0)
        if key == "flex":
            flex += int(count or 0)
        elif key in {"rigid-flex", "rigidflex"}:
            rigid_flex += int(count or 0)
        elif key == "rigid" or not key:
            rigid += int(count or 0)
    return {
        "rigid": rigid,
        "flex": flex,
        "rigidFlex": rigid_flex,
        "total": total,
    }


def list_reports(
    *,
    search: str | None = None,
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "updatedAt",
    sort_dir: str = "desc",
) -> dict:
    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 10), 100))
    sort_key = sort_by if sort_by in SORTABLE else "updatedAt"
    direction = (sort_dir or "desc").lower()
    column = SORTABLE[sort_key]
    order = desc(column) if direction == "desc" else asc(column)

    query = CocReport.query.filter(CocReport.is_deleted == False)  # noqa: E712 — MSSQL bit column

    q = _clean(search)
    if q:
        pattern = f"%{q.lower()}%"
        query = query.filter(
            or_(
                func.lower(CocReport.production_order).like(pattern),
                func.lower(CocReport.part_number).like(pattern),
            )
        )

    total = query.count()
    rows = (
        query.order_by(order, desc(CocReport.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1

    return {
        "reports": rows,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "total": total,
            "totalPages": total_pages,
        },
        "stats": _pcb_stats(),
        "sort": {"sortBy": sort_key, "sortDir": "desc" if direction == "desc" else "asc"},
        "search": q,
    }


def get_report(report_id: str) -> tuple[CocReport | None, str | None]:
    report = CocReport.query.filter_by(id=report_id, is_deleted=False).first()
    if not report:
        return None, "Report not found."
    return report, None


def create_report(
    payload: dict,
    *,
    user_id: str | None = None,
    uid: str | None = None,
    name: str | None = None,
    status: str = "in-progress",
) -> tuple[CocReport | None, str | None]:
    if not isinstance(payload, dict):
        return None, "payload is required."

    summary = _summary_from_payload(payload)
    report = CocReport(
        status=status or "saved",
        created_by_user_id=_clean(user_id) or None,
        created_by_uid=_clean(uid) or None,
        created_by_name=_clean(name) or None,
        updated_by_uid=_clean(uid) or None,
        **summary,
    )
    report.set_payload(payload)
    db.session.add(report)
    db.session.commit()
    return report, None


def update_report(
    report_id: str,
    payload: dict,
    *,
    uid: str | None = None,
    status: str | None = None,
) -> tuple[CocReport | None, str | None]:
    report, error = get_report(report_id)
    if error or not report:
        return None, error or "Report not found."
    if not isinstance(payload, dict):
        return None, "payload is required."

    summary = _summary_from_payload(payload)
    for key, value in summary.items():
        setattr(report, key, value)
    if status:
        report.status = status
    report.updated_by_uid = _clean(uid) or report.updated_by_uid
    report.updated_at = utcnow()
    report.set_payload(payload)
    db.session.commit()
    return report, None


def soft_delete_report(report_id: str, *, uid: str | None = None) -> tuple[bool, str | None]:
    report, error = get_report(report_id)
    if error or not report:
        return False, error or "Report not found."
    report.is_deleted = True
    report.updated_by_uid = _clean(uid) or report.updated_by_uid
    report.updated_at = utcnow()
    db.session.commit()
    return True, None
