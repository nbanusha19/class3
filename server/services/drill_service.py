from sqlalchemy import text

from utils.db import get_db_engine

PCBDETAILS_KEY_SQL = """
SELECT TOP 1 a.PCBDETAILS_KEY, d.PCB_THICKNESS
FROM TrackingKannan.dbo.Traveler t
INNER JOIN HIQ.dbo.ORDER_DETAILS a ON t.WorkOrder = a.ORDER_KEY
INNER JOIN HIQ.dbo.PCB_DETAILS d ON a.PCBDETAILS_KEY = d.PCBDETAILS_KEY
WHERE LTRIM(RTRIM(t.TRAVNUMBER)) = :trav_number
"""

DRILL_INFO_SQL = """
SELECT
    a.FINISHED_SIZE,
    a.QTY,
    a.DRILL_TYPE,
    a.DRILL_TOL_PLUS,
    a.DRILL_TOL_MINUS
FROM HIQ.dbo.PCB_DETAILS_DRILL_INFO a
INNER JOIN HIQ.dbo.PCB_DETAILS b ON a.PCBDETAILS_KEY = b.PCBDETAILS_KEY
WHERE a.PCBDETAILS_KEY = :pcbdetails_key
ORDER BY a.DRILL_TYPE, a.FINISHED_SIZE, a.QTY
"""


def _clean(value: object | None) -> str:
    if value is None:
        return ""
    text_value = str(value).strip()
    if text_value.lower() in {"null", "none", "nan"}:
        return ""
    return text_value


def _num(value: object | None) -> str:
    raw = _clean(value)
    if not raw:
        return ""
    try:
        number = float(raw)
        if number == int(number):
            return str(int(number))
        text = f"{number:.6f}".rstrip("0").rstrip(".")
        return text
    except (TypeError, ValueError):
        return raw


def fetch_drill_info(production_order: str) -> tuple[dict | None, str | None]:
    trav = (production_order or "").strip()
    if not trav:
        return None, "Enter a production order number."

    engine = get_db_engine()
    if engine is None:
        return None, "Database is not configured."

    try:
        with engine.connect() as conn:
            header = conn.execute(text(PCBDETAILS_KEY_SQL), {"trav_number": trav}).mappings().first()
            if not header or header.get("PCBDETAILS_KEY") is None:
                return None, "No traveler found for this production order number."
            rows = conn.execute(
                text(DRILL_INFO_SQL),
                {"pcbdetails_key": header["PCBDETAILS_KEY"]},
            ).mappings().all()
    except Exception as exc:
        return None, f"Database error: {exc}"

    drills = [
        {
            "finishedSize": _num(row.get("FINISHED_SIZE")),
            "qty": _num(row.get("QTY")),
            "drillType": _clean(row.get("DRILL_TYPE")),
            "tolPlus": _num(row.get("DRILL_TOL_PLUS")),
            "tolMinus": _num(row.get("DRILL_TOL_MINUS")),
        }
        for row in rows
    ]
    return (
        {
            "drills": drills,
            "pcbThickness": _num(header.get("PCB_THICKNESS")),
        },
        None,
    )
