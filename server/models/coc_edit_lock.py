from datetime import datetime, timezone

from extensions import db


class CocEditLock(db.Model):
    __tablename__ = "coc_edit_locks"

    production_order = db.Column(db.String(100), primary_key=True)
    owner_uid = db.Column(db.String(100), nullable=False)
    owner_name = db.Column(db.String(200), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=False), nullable=False)

    @staticmethod
    def now():
        return datetime.now(timezone.utc).replace(tzinfo=None)