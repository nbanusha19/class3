from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from extensions import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CocReport(db.Model):
    """Saved Class 3 COC / report suite document (writable Class3Report DB only)."""

    __tablename__ = "coc_reports"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    production_order = db.Column(db.String(100), nullable=True, index=True)
    coc_number = db.Column(db.String(200), nullable=True, index=True)
    coc_date = db.Column(db.String(20), nullable=True)
    customer = db.Column(db.String(255), nullable=True)
    customer_address = db.Column(db.Text, nullable=True)
    part_number = db.Column(db.String(200), nullable=True)
    po_number = db.Column(db.String(100), nullable=True)
    specification = db.Column(db.String(255), nullable=True)
    regulatory_requirement = db.Column(db.String(255), nullable=True)
    pcb_suite_type = db.Column(db.String(50), nullable=True, default="rigid")
    status = db.Column(db.String(30), nullable=False, default="saved")
    # Full form state: { shared, fields, tables, pcbSuiteType }
    payload_json = db.Column(db.UnicodeText, nullable=False, default="{}")

    created_by_user_id = db.Column(db.String(50), nullable=True)
    created_by_uid = db.Column(db.String(100), nullable=True)
    created_by_name = db.Column(db.String(200), nullable=True)
    updated_by_uid = db.Column(db.String(100), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)

    def get_payload(self) -> dict:
        try:
            data = json.loads(self.payload_json or "{}")
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def set_payload(self, payload: dict | None) -> None:
        self.payload_json = json.dumps(payload or {}, ensure_ascii=False)

    def to_summary(self) -> dict:
        return {
            "id": self.id,
            "productionOrder": self.production_order or "",
            "cocNumber": self.coc_number or "",
            "cocDate": self.coc_date or "",
            "customer": self.customer or "",
            "partNumber": self.part_number or "",
            "poNumber": self.po_number or "",
            "specification": self.specification or "",
            "regulatoryRequirement": self.regulatory_requirement or "",
            "pcbSuiteType": self.pcb_suite_type or "rigid",
            "status": self.status,
            "createdByUid": self.created_by_uid or "",
            "createdByName": self.created_by_name or "",
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_dict(self) -> dict:
        data = self.to_summary()
        data["payload"] = self.get_payload()
        return data
