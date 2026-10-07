from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import func, text

from extensions import db
from models.coc_report import CocReport
from utils.db import get_db_engine

WIP_LOTS_SQL = """
SELECT TOP 400
    t.TRAVNUMBER,
    c.COMPANY_NAME,
    a.ORDER_NUMBER,
    fa.CUST_SPEC_VALUE AS specification,
    e.IPC_CLASS AS regulatoryRequirement,
    COALESCE(t.SALESQTY, t.TotExpectedPc, CAST(a.ORDER_QTY AS int), 0) AS qty,
    t.LaunchPanel,
    COALESCE(t.LaunchDate, t.CreatedON, t.LastModifiedDate) AS received,
    LTRIM(RTRIM(CONCAT(
        ISNULL(d.HIQ_PARTNO, ''),
        '-',
        ISNULL(CAST(d.VersionMajor AS varchar(20)), ''),
        ISNULL(CAST(d.VersionMinor AS varchar(20)), '')
    ))) AS camNumber,
    d.PCB_PARTNO
FROM TrackingKannan.dbo.Traveler t
INNER JOIN HIQ.dbo.ORDER_DETAILS a ON t.WorkOrder = a.ORDER_KEY
INNER JOIN HIQ.dbo.COMPANY_DETAILS c ON a.BILLCOMPANY_KEY = c.COMPANY_KEY
INNER JOIN HIQ.dbo.PCB_DETAILS d ON a.PCBDETAILS_KEY = d.PCBDETAILS_KEY
LEFT JOIN TrackingKannan.dbo.TravelerIPC e ON d.RegReqID = e.IPC_ID
LEFT JOIN TrackingKannan.dbo.PCB_DETAILS_CUST_SPEC fa ON d.CustSpecID = fa.CUST_SPEC_ID
WHERE ISNULL(t.ProductionCancel, 0) = 0
  AND ISNULL(t.IsActive, 1) = 1
  AND COALESCE(t.LaunchDate, t.CreatedON, t.LastModifiedDate) >= DATEADD(day, -120, GETDATE())
  AND (
    UPPER(RTRIM(e.IPC_CLASS)) LIKE '%CL-3'
    OR UPPER(RTRIM(e.IPC_CLASS)) LIKE '%CLASS-3'
  )
ORDER BY COALESCE(t.LaunchDate, t.CreatedON, t.LastModifiedDate) DESC
"""

IN_PROGRESS_STATUSES = ("in-progress", "saved")
STAGE_STATUSES = {
    "in-progress": IN_PROGRESS_STATUSES,
    "verification": ("verification",),
    "approved": ("approved",),
}


def _clean(value: object | None) -> str:
    if value is None:
        return ""
    text_value = str(value).strip()
    if text_value.lower() in {"null", "none", "nan"}:
        return ""
    return text_value


def _format_received(value: object | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%d %b %H:%M")
    return _clean(value)


def _format_ipc(raw: str) -> str:
    text_value = " ".join(_clean(raw).split())
    if not text_value:
        return "—"
    return (
        text_value.replace("CLASS", "Cl")
        .replace("Class", "Cl")
        .replace("class", "Cl")
        .replace("Cl  ", "Cl ")
    )


def _format_qty(value: object | None) -> str:
    raw = _clean(value)
    if not raw:
        return "0"
    try:
        number = float(raw)
        return str(int(number)) if number == int(number) else raw
    except (TypeError, ValueError):
        return raw


def _dash(value: str) -> str:
    return value if value else "—"


def _is_class_3_ipc(raw: object | None) -> bool:
    text = _clean(raw).upper().replace(" ", "")
    return text.endswith("CL-3") or text.endswith("CLASS-3")


def _started_orders() -> set[str]:
    rows = (
        db.session.query(CocReport.production_order, CocReport.payload_json)
        .filter(CocReport.is_deleted == False)  # noqa: E712 — MSSQL bit column
        .all()
    )
    started: set[str] = set()
    for order, payload_json in rows:
        token = _clean(order)
        if token:
            started.add(token)
        try:
            payload = json.loads(payload_json or "{}")
        except Exception:
            payload = {}
        combined = payload.get("combinedProductionOrders")
        if combined is None and isinstance(payload.get("shared"), dict):
            combined = payload["shared"].get("combinedProductionOrders")
        if isinstance(combined, str):
            combined = [part.strip() for part in combined.split(",") if part.strip()]
        if isinstance(combined, list):
            for item in combined:
                token = _clean(item)
                if token:
                    started.add(token)
    return started


def _stage_counts() -> dict[str, int]:
    rows = (
        db.session.query(CocReport.status, func.count(CocReport.id))
        .filter(CocReport.is_deleted == False)  # noqa: E712 — MSSQL bit column
        .group_by(CocReport.status)
        .all()
    )
    in_progress = verification = approved = 0
    for status, count in rows:
        key = _clean(status).lower()
        n = int(count or 0)
        if key in {"verification"}:
            verification += n
        elif key in {"approved"}:
            approved += n
        else:
            in_progress += n
    return {
        "wip": 0,
        "inProgress": in_progress,
        "verification": verification,
        "approved": approved,
    }


def _fetch_wip_lots() -> list[dict]:
    engine = get_db_engine()
    if engine is None:
        return []
    started = _started_orders()
    try:
        with engine.connect() as conn:
            rows = conn.execute(text(WIP_LOTS_SQL)).mappings().all()
    except Exception:
        return []

    lots: list[dict] = []
    seen: set[str] = set()
    for row in rows:
        production = _clean(row.get("TRAVNUMBER"))
        if not production or production in started or production in seen:
            continue
        if not _is_class_3_ipc(row.get("regulatoryRequirement")):
            continue
        seen.add(production)
        cam = _clean(row.get("camNumber")).strip("-")
        if cam in {"", "-"}:
            cam = ""
        lots.append(
            {
                "productionOrder": production,
                "cocNumber": "",
                "customer": _clean(row.get("COMPANY_NAME")),
                "camNumber": cam,
                "poNumber": _clean(row.get("ORDER_NUMBER")),
                "customerSpec": _dash(_clean(row.get("specification"))),
                "ipcStandard": _format_ipc(_clean(row.get("regulatoryRequirement"))),
                "regulatoryRequirement": _clean(row.get("regulatoryRequirement")),
                "specification": _clean(row.get("specification")),
                "partNumber": _clean(row.get("PCB_PARTNO")),
                "qty": _format_qty(row.get("qty")),
                "launchPanel": _format_qty(row.get("LaunchPanel")) if _clean(row.get("LaunchPanel")) else "",
                "received": _format_received(row.get("received")),
                "receivedAt": (
                    row.get("received").isoformat()
                    if isinstance(row.get("received"), datetime)
                    else str(row.get("received") or "")
                ),
                "status": "wip",
            }
        )
    return lots


def _report_to_row(report: CocReport) -> dict:
    payload = report.get_payload()
    shared = payload.get("shared") if isinstance(payload.get("shared"), dict) else {}
    fields = payload.get("fields") if isinstance(payload.get("fields"), dict) else {}
    cam = _clean(shared.get("camNumber") or payload.get("camNumber"))
    qty = _clean(shared.get("quantity") or payload.get("quantity"))
    received = _clean(payload.get("received") or shared.get("received"))
    if not received and report.updated_at:
        received = report.updated_at.strftime("%d %b %H:%M")
    combined = payload.get("combinedProductionOrders") or []
    if isinstance(combined, str):
        combined = [part.strip() for part in combined.split(",") if part.strip()]
    return {
        "id": report.id,
        "productionOrder": report.production_order or "",
        "cocNumber": report.coc_number or "",
        "customer": report.customer or "",
        "camNumber": cam,
        "poNumber": report.po_number or "",
        "customerSpec": _dash(report.specification or ""),
        "ipcStandard": _format_ipc(report.regulatory_requirement or ""),
        "regulatoryRequirement": report.regulatory_requirement or "",
        "specification": report.specification or "",
        "partNumber": report.part_number or "",
        "qty": qty,
        "received": received,
        "receivedAt": report.updated_at.isoformat() if report.updated_at else "",
        "status": (report.status or "in-progress").lower(),
        "createdByName": report.created_by_name or "",
        "inspectedBy": _clean(fields.get("f1.inspectedBy")),
        "verifiedBy": _clean(fields.get("f1.verifiedBy")),
        "updatedAt": report.updated_at.isoformat() if report.updated_at else None,
        "combinedProductionOrders": combined if isinstance(combined, list) else [],
    }


SORTABLE_KEYS = {
    "productionOrder",
    "cocNumber",
    "customer",
    "camNumber",
    "poNumber",
    "customerSpec",
    "ipcStandard",
    "qty",
    "received",
    "partNumber",
}


def _sort_value(row: dict, key: str):
    if key == "qty":
        try:
            return float(row.get("qty") or 0)
        except (TypeError, ValueError):
            return 0.0
    if key == "received":
        return str(row.get("receivedAt") or row.get("received") or "").lower()
    value = row.get(key)
    if value is None:
        return ""
    text = str(value).strip()
    if key in {"productionOrder", "poNumber", "cocNumber"} and text.isdigit():
        return (0, int(text))
    return (1, text.lower())


def list_workload(
    *,
    stage: str = "wip",
    search: str | None = None,
    customer: str | None = None,
    overdue_first: bool = False,
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "received",
    sort_dir: str = "desc",
) -> dict:
    stage_key = (stage or "wip").lower().strip()
    if stage_key not in {"wip", "in-progress", "verification", "approved"}:
        stage_key = "wip"

    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 10), 100))
    q = _clean(search).lower()
    customer_filter = _clean(customer).lower()
    sort_key = sort_by if sort_by in SORTABLE_KEYS else "received"
    direction = (sort_dir or "desc").lower()
    if overdue_first:
        sort_key = "received"
        direction = "asc"
    reverse = direction != "asc"

    stats = _stage_counts()
    wip_lots = _fetch_wip_lots()
    stats["wip"] = len(wip_lots)

    if stage_key == "wip":
        rows = wip_lots
    else:
        statuses = STAGE_STATUSES[stage_key]
        query = CocReport.query.filter(CocReport.is_deleted == False)  # noqa: E712
        query = query.filter(func.lower(CocReport.status).in_(statuses))
        reports = query.order_by(CocReport.updated_at.desc()).all()
        rows = [_report_to_row(report) for report in reports]

    if q:
        rows = [
            row
            for row in rows
            if q in (row.get("productionOrder") or "").lower()
            or q in (row.get("cocNumber") or "").lower()
            or q in (row.get("customer") or "").lower()
            or q in (row.get("camNumber") or "").lower()
            or q in (row.get("poNumber") or "").lower()
            or q in (row.get("partNumber") or "").lower()
            or q in (row.get("customerSpec") or "").lower()
            or q in (row.get("ipcStandard") or "").lower()
        ]

    customers = sorted({row.get("customer") or "" for row in rows if row.get("customer")})

    if customer_filter and customer_filter != "all":
        rows = [row for row in rows if (row.get("customer") or "").lower() == customer_filter]

    rows.sort(key=lambda row: _sort_value(row, sort_key), reverse=reverse)

    total = len(rows)
    start = (page - 1) * page_size
    paged = rows[start : start + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    if page > total_pages:
        page = total_pages
        start = (page - 1) * page_size
        paged = rows[start : start + page_size]

    return {
        "stage": stage_key,
        "rows": paged,
        "stats": stats,
        "customers": customers,
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "total": total,
            "totalPages": total_pages,
        },
        "sort": {"sortBy": sort_key, "sortDir": "asc" if direction == "asc" else "desc"},
        "search": _clean(search),
    }
