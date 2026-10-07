from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from extensions import db
from models.coc_report import utcnow
from models.coc_report_file import CocReportFile
from services import report_service

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
_SAFE_SEGMENT = re.compile(r"[^A-Za-z0-9._-]+")


def upload_root() -> Path:
    root = Path(current_app.config["UPLOAD_FOLDER"])
    root.mkdir(parents=True, exist_ok=True)
    return root.resolve()


def _safe_segment(value: str, fallback: str) -> str:
    cleaned = _SAFE_SEGMENT.sub("_", (value or "").strip())[:40].strip("._")
    return cleaned or fallback


def _absolute_path(relative: str) -> Path:
    root = upload_root()
    full = (root / relative).resolve()
    full.relative_to(root)
    return full


def _table_key(form: str) -> str:
    return f"{form}.checklist"


def _parse_attachments(raw: object) -> list[dict]:
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    if not isinstance(raw, str) or not raw.strip():
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, dict)]


def _dump_attachments(files: list[dict]) -> str:
    slim: list[dict] = []
    for item in files:
        name = str(item.get("name") or "").strip()
        file_id = str(item.get("id") or "").strip()
        path = str(item.get("path") or "").strip()
        data_url = str(item.get("dataUrl") or "")
        if not name:
            continue
        if file_id or path:
            entry: dict[str, str] = {"name": name}
            if file_id:
                entry["id"] = file_id
            if path:
                entry["path"] = path
            slim.append(entry)
        elif data_url:
            slim.append({"name": name, "dataUrl": data_url})
    return json.dumps(slim, ensure_ascii=False)


def _patch_row_attachments(payload: dict, form: str, row_sl: str, mutate) -> dict:
    tables = payload.get("tables")
    if not isinstance(tables, dict):
        tables = {}
        payload["tables"] = tables
    rows = tables.get(_table_key(form))
    if not isinstance(rows, list):
        return payload
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("sl") or "") != str(row_sl):
            continue
        files = _parse_attachments(row.get("attachments"))
        row["attachments"] = _dump_attachments(mutate(files))
        break
    return payload


def save_report_file(
    report_id: str,
    storage: FileStorage,
    *,
    form: str = "f3",
    row_sl: str = "",
    uid: str | None = None,
) -> tuple[CocReportFile | None, str | None]:
    report, error = report_service.get_report(report_id)
    if error or not report:
        return None, error or "Report not found."
    if storage is None or not (storage.filename or "").strip():
        return None, "file is required."

    raw_name = (storage.filename or "document").strip()
    safe_name = secure_filename(raw_name) or "document"
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return None, "Only PDF, PNG, and JPEG files are allowed."

    form_key = _safe_segment(form, "f3").lower()
    sl = _safe_segment(row_sl, "row")
    file_id = str(uuid.uuid4())
    stem = Path(safe_name).stem[:80] or "document"
    relative = Path(report.id) / form_key / sl / f"{file_id}_{stem}{ext}"
    dest = _absolute_path(relative.as_posix())
    dest.parent.mkdir(parents=True, exist_ok=True)
    storage.save(dest)

    rec = CocReportFile(
        id=file_id,
        report_id=report.id,
        form=form_key,
        row_sl=sl,
        original_name=(raw_name or safe_name)[:255],
        stored_path=relative.as_posix(),
        mime_type=(storage.mimetype or "")[:100] or None,
        size_bytes=dest.stat().st_size,
        created_by_uid=uid,
    )
    db.session.add(rec)

    attachment = {"id": rec.id, "name": rec.original_name, "path": rec.stored_path}

    def append(files: list[dict]) -> list[dict]:
        if any(str(item.get("id") or "") == rec.id for item in files):
            return files
        return [*files, attachment]

    report.set_payload(_patch_row_attachments(report.get_payload(), form_key, sl, append))
    report.updated_at = utcnow()
    db.session.commit()
    return rec, None


def get_file(report_id: str, file_id: str) -> tuple[CocReportFile | None, str | None]:
    report, error = report_service.get_report(report_id)
    if error or not report:
        return None, error or "Report not found."
    rec = CocReportFile.query.filter_by(id=file_id, report_id=report.id).first()
    if not rec:
        return None, "File not found."
    return rec, None


def file_disk_path(rec: CocReportFile) -> Path:
    return _absolute_path(rec.stored_path)


def delete_report_file(
    report_id: str,
    file_id: str,
) -> tuple[bool, str | None]:
    rec, error = get_file(report_id, file_id)
    if error or not rec:
        return False, error or "File not found."

    report, report_error = report_service.get_report(report_id)
    if report_error or not report:
        return False, report_error or "Report not found."

    try:
        disk = file_disk_path(rec)
        if disk.is_file():
            disk.unlink()
    except ValueError:
        pass
    except OSError:
        pass

    form_key = rec.form
    sl = rec.row_sl
    removed_id = rec.id

    def drop(files: list[dict]) -> list[dict]:
        return [item for item in files if str(item.get("id") or "") != removed_id]

    report.set_payload(_patch_row_attachments(report.get_payload(), form_key, sl, drop))
    report.updated_at = utcnow()
    db.session.delete(rec)
    db.session.commit()
    return True, None
