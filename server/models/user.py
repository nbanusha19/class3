from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() in {"null", "none", "nan"}:
        return ""
    return text


@dataclass(frozen=True)
class TrackingUser:
    """Read-only view of dbo.[User] from TrackingKannan. Never persisted by this app."""

    user_id: int
    uid: str
    user_name: str
    user_active: bool
    is_admin: bool
    role_id: int | None
    email_id: str

    @classmethod
    def from_row(cls, row: Mapping[str, Any]) -> TrackingUser:
        return cls(
            user_id=int(row["UserID"]),
            uid=_clean(row.get("UID")),
            user_name=_clean(row.get("UserName")) or _clean(row.get("UID")),
            user_active=_as_bool(row.get("UserActive")),
            is_admin=_as_bool(row.get("IsAdmin")),
            role_id=int(row["RoleID"]) if row.get("RoleID") is not None else None,
            email_id=_clean(row.get("EmailID")),
        )

    @property
    def role(self) -> str:
        return "admin" if self.is_admin else "user"

    @property
    def role_label(self) -> str:
        return "Admin" if self.is_admin else "User"

    def to_dict(self) -> dict[str, Any]:
        email = self.email_id or f"{self.uid.lower()}@hiqelectronics.com"
        return {
            "id": str(self.user_id),
            "userId": self.uid,
            "uid": self.uid,
            "name": self.user_name,
            "role": self.role,
            "roleLabel": self.role_label,
            "email": email,
            "isActive": self.user_active,
            "isAdmin": self.is_admin,
            "roleId": self.role_id,
        }
