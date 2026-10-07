from __future__ import annotations

import uuid
from datetime import datetime, timezone

from extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CocReportFile(db.Model):
    """Uploaded CoC / inspection document. Files live on disk; this row stores the path."""

    __tablename__ = "coc_report_files"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = db.Column(db.String(36), nullable=False, index=True)
    form = db.Column(db.String(20), nullable=False, default="f3")
    row_sl = db.Column(db.String(40), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    stored_path = db.Column(db.String(500), nullable=False)
    mime_type = db.Column(db.String(100), nullable=True)
    size_bytes = db.Column(db.Integer, nullable=True)
    created_by_uid = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "reportId": self.report_id,
            "form": self.form,
            "rowSl": self.row_sl,
            "name": self.original_name,
            "path": self.stored_path,
            "mimeType": self.mime_type or "",
            "size": self.size_bytes,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
