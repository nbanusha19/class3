from datetime import datetime

from sqlalchemy import text

from utils.db import get_db_engine

COC_BY_TRAVNUMBER_SQL = """
SELECT TOP 1
    t.TRAVNUMBER,
    c.COMPANY_NAME,
    a.ORDER_NUMBER,
    a.PARTNO_ONPUR,
    d.PCB_PARTNO,
    d.PCB_REVISIONNO,
    d.ULMARK,
    LTRIM(RTRIM(CONCAT(
        ISNULL(c.ADDR1, ''), ' ',
        ISNULL(c.ADDR2, ''), ' ',
        ISNULL(c.ADDR3, ''), ' ',
        ISNULL(c.ADDR4, ''), ' ',
        ISNULL(c.ADDR5, '')
    ))) AS customerAddress,
    e.IPC_CLASS AS regulatoryRequirement,
    fa.CUST_SPEC_VALUE AS specification,
    f.PCB_MATERIAL_NAME,
    d.LAYER_COUNT,
    d.PCB_THICKNESS,
    d.BBTType,
    d.ViaProtection,
    d.BackDrilling,
    d.SurfaceFinish,
    d.SolderMask,
    d.LegendPrint,
    d.ROHS,
    d.IMPEDANCE_CONTROL,
    d.SUPPLYPANELS,
    d.NOOFPIECES_PERSUPPLYPANEL,
    d.NOOFBOARDS,
    t.LaunchPanel,
    LTRIM(RTRIM(CONCAT(
        ISNULL(d.HIQ_PARTNO, ''),
        '-',
        ISNULL(CAST(d.VersionMajor AS varchar(20)), ''),
        ISNULL(CAST(d.VersionMinor AS varchar(20)), '')
    ))) AS camNumber,
    COALESCE(t.SALESQTY, t.TotExpectedPc, CAST(a.ORDER_QTY AS int), 0) AS qty,
    COALESCE(t.LaunchDate, t.CreatedON, t.LastModifiedDate) AS received
FROM TrackingKannan.dbo.Traveler t
INNER JOIN HIQ.dbo.ORDER_DETAILS a ON t.WorkOrder = a.ORDER_KEY
INNER JOIN HIQ.dbo.COMPANY_DETAILS c ON a.BILLCOMPANY_KEY = c.COMPANY_KEY
INNER JOIN HIQ.dbo.PCB_DETAILS d ON a.PCBDETAILS_KEY = d.PCBDETAILS_KEY
LEFT JOIN TrackingKannan.dbo.TravelerIPC e ON d.RegReqID = e.IPC_ID
LEFT JOIN TrackingKannan.dbo.PCB_DETAILS_MATERIALS f ON d.PCB_MATERIAL_ID = f.PCB_MATERIAL_ID
LEFT JOIN TrackingKannan.dbo.PCB_DETAILS_CUST_SPEC fa ON d.CustSpecID = fa.CUST_SPEC_ID
WHERE LTRIM(RTRIM(t.TRAVNUMBER)) = :trav_number
"""


def _clean(value: object | None) -> str:
    if value is None:
        return ""
    text_value = str(value).strip()
    if text_value.lower() in {"null", "none", "nan"}:
        return ""
    return text_value


def _token(value: object | None) -> str:
    return " ".join(_clean(value).split())


def _yes_no_na(value: object | None) -> str:
    raw = _clean(value)
    if not raw:
        return ""
    lowered = raw.lower()
    if lowered in {"1", "y", "yes", "true"}:
        return "Yes"
    if lowered in {"0", "n", "no", "false"}:
        return "No"
    if lowered in {"na", "n/a", "-"}:
        return "NA"
    if raw in {"Yes", "No", "NA"}:
        return raw
    return raw


def build_coc_number(production_order: str, when: datetime | None = None) -> str:
    """{productionOrder}-{DDMMYY}"""
    stamp = (when or datetime.now()).strftime("%d%m%y")
    order = _token(production_order).strip("-")
    if not order:
        return stamp
    return f"{order}-{stamp}"


def _parse_coc_date(value: str | None) -> datetime:
    raw = _clean(value)
    if not raw:
        return datetime.now()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d%m%y", "%d%m%Y"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return datetime.now()


def _format_received(value: object | None) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%d %b %H:%M")
    return _clean(value)


def _format_decimal(value: object | None) -> str:
    raw = _clean(value)
    if not raw:
        return ""
    try:
        number = float(raw)
        if number == int(number):
            return str(int(number))
        return f"{number:.6f}".rstrip("0").rstrip(".")
    except (TypeError, ValueError):
        return raw


def _format_qty(value: object | None) -> str:
    raw = _clean(value)
    if not raw:
        return ""
    try:
        number = float(raw)
        return str(int(number)) if number == int(number) else raw
    except (TypeError, ValueError):
        return raw


def _ul_mark(value: object | None) -> str:
    """ULMARK is Yes/No only: NO → No; any other value → Yes."""
    raw = _clean(value)
    if not raw:
        return ""
    if raw.lower() in {"0", "n", "no", "false", "na", "n/a", "-", "—", "none", "nil"}:
        return "No"
    return "Yes"


def _rohs(value: object | None) -> str:
    raw = _clean(value).upper().replace("&", "AND")
    raw = " ".join(raw.split())
    if raw in {"1", "Y", "YES", "TRUE", "ROHS", "ROHS COMPLIANT"}:
        return "ROHS"
    if raw in {"2", "REACH"}:
        return "REACH"
    if raw in {"3", "BOTH", "ROHS AND REACH", "ROHS+REACH"}:
        return "ROHS & REACH"
    if raw in {"0", "N", "NO", "FALSE", "NA", "N/A", "-", "—"}:
        return ""
    if _clean(value) in {"ROHS", "REACH", "ROHS & REACH"}:
        return _clean(value)
    return ""


def _supply_form(value: object | None) -> str:
    raw = _clean(value).upper()
    mapping = {
        "SINGLE": "Single",
        "SIN": "Single",
        "ARRAY": "Array",
        "ARR": "Array",
        "SETS": "Sets",
        "MERGED": "Merged",
    }
    if raw in mapping:
        return mapping[raw]
    return _clean(value)


def fetch_coc_by_production_order(
    production_order: str,
    coc_date: str | None = None,
) -> tuple[dict | None, str | None]:
    trav = (production_order or "").strip()
    if not trav:
        return None, "Enter a production order number."

    engine = get_db_engine()
    if engine is None:
        return None, "Database is not configured."

    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(COC_BY_TRAVNUMBER_SQL),
                {"trav_number": trav},
            ).mappings().first()
    except Exception as exc:
        return None, f"Database error: {exc}"

    if not row:
        return None, "No traveler found for this production order number."

    when = _parse_coc_date(coc_date)
    production = _clean(row.get("TRAVNUMBER")) or trav
    part_rev = _clean(row.get("PCB_REVISIONNO"))
    cam_number = _clean(row.get("camNumber")).strip("-")
    if cam_number in {"", "-"}:
        cam_number = ""

    return (
        {
            "productionOrder": production,
            "camNumber": cam_number,
            "cocNumber": build_coc_number(production, when),
            "cocDate": when.strftime("%Y-%m-%d"),
            "customer": _clean(row.get("COMPANY_NAME")),
            "customerAddress": _clean(row.get("customerAddress")),
            "partNumber": _clean(row.get("PCB_PARTNO")),
            "partRev": part_rev,
            "partNumberPo": _clean(row.get("PARTNO_ONPUR")),
            "poNumber": _clean(row.get("ORDER_NUMBER")),
            "specification": _clean(row.get("specification")),
            "regulatoryRequirement": _clean(row.get("regulatoryRequirement")),
            "material": _clean(row.get("PCB_MATERIAL_NAME")),
            "layers": _clean(row.get("LAYER_COUNT")),
            "pcbThickness": _format_decimal(row.get("PCB_THICKNESS")),
            "bbtType": _clean(row.get("BBTType")),
            "viaProtection": _clean(row.get("ViaProtection")),
            "solderMask": _clean(row.get("SolderMask")),
            "legendPrint": _yes_no_na(row.get("LegendPrint")),
            "backDrilling": _yes_no_na(row.get("BackDrilling")),
            "boardFinish": _clean(row.get("SurfaceFinish")),
            "rohs": _rohs(row.get("ROHS")),
            "ulMark": _ul_mark(row.get("ULMARK")),
            "impedanceControl": _yes_no_na(row.get("IMPEDANCE_CONTROL")),
            "quantity": _format_qty(row.get("qty")),
            "received": _format_received(row.get("received")),
            "supplyForm": _supply_form(row.get("SUPPLYPANELS")),
            "pcbPerArray": _format_qty(row.get("NOOFPIECES_PERSUPPLYPANEL")),
            "pcbPerPanel": _format_qty(row.get("NOOFBOARDS")),
            "launchPanel": _format_qty(row.get("LaunchPanel")),
        },
        None,
    )


# Backward-compatible alias
def fetch_coc_by_trav_number(trav_number: str) -> tuple[dict | None, str | None]:
    return fetch_coc_by_production_order(trav_number)
