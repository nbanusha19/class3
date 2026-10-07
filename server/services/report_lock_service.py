from datetime import timedelta

from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError

from extensions import db
from models.coc_edit_lock import CocEditLock

LOCK_TTL = timedelta(seconds=60)


def normalize_lock_key(value: object) -> str:
    token = " ".join(str(value or "").split()).upper()
    if not token:
        return ""
    if token.startswith("PO:") or token.startswith("COC:"):
        return token
    return f"PO:{token}"


def production_orders_from_payload(payload: dict) -> list[str]:
    shared = payload.get("shared") if isinstance(payload.get("shared"), dict) else {}
    fields = payload.get("fields") if isinstance(payload.get("fields"), dict) else {}

    raw_orders: list[object] = [
        fields.get("f1.productionOrder"),
        shared.get("batchCode"),
        shared.get("productionOrder"),
    ]
    combined = payload.get("combinedProductionOrders")
    if isinstance(combined, list):
        raw_orders.extend(combined)

    keys = {
        normalize_lock_key(order)
        for value in raw_orders
        for order in str(value or "").split(",")
        if normalize_lock_key(order)
    }

    coc_number = " ".join(str(shared.get("cocNumber") or "").split())
    if coc_number:
        keys.add(f"COC:{coc_number.upper()}")

    return sorted(keys)


def report_production_orders(report) -> list[str]:
    keys = set(production_orders_from_payload(report.get_payload()))
    if report.production_order:
        keys.add(normalize_lock_key(report.production_order))
    if report.coc_number:
        keys.add(f"COC:{' '.join(report.coc_number.split()).upper()}")
    return sorted(key for key in keys if key)


def acquire_locks(
    production_orders: list[str], owner_uid: str, owner_name: str
) -> tuple[list[str], str | None]:
    orders = sorted({normalize_lock_key(order) for order in production_orders if normalize_lock_key(order)})
    if not orders:
        return [], "A production order is required."

    now = CocEditLock.now()
    expires_at = now + LOCK_TTL
    try:
        for order in orders:
            if db.engine.dialect.name == "mssql":
                lock_result = db.session.execute(
                    text(
                        """
                        DECLARE @lock_result int;
                        EXEC @lock_result = sp_getapplock
                            @Resource = :resource,
                            @LockMode = 'Exclusive',
                            @LockOwner = 'Transaction',
                            @LockTimeout = 10000;
                        SELECT @lock_result;
                        """
                    ),
                    {"resource": f"class3-report-lock:{order}"},
                ).scalar()
                if lock_result is None or lock_result < 0:
                    db.session.rollback()
                    return [], "Unable to acquire the production-order lock. Please retry."

            conflict = (
                CocEditLock.query.filter_by(production_order=order)
                .filter(CocEditLock.expires_at > now, CocEditLock.owner_uid != owner_uid)
                .order_by(CocEditLock.expires_at.desc())
                .first()
            )
            if conflict:
                db.session.rollback()
                return [], (
                    f"Production order {conflict.production_order} is already being "
                    f"used by {conflict.owner_name}."
                )

            updated = (
                CocEditLock.query.filter_by(production_order=order)
                .filter(or_(CocEditLock.owner_uid == owner_uid, CocEditLock.expires_at <= now))
                .update(
                    {
                        CocEditLock.owner_uid: owner_uid,
                        CocEditLock.owner_name: owner_name,
                        CocEditLock.expires_at: expires_at,
                    },
                    synchronize_session=False,
                )
            )
            if updated:
                continue

            db.session.add(
                CocEditLock(
                    production_order=order,
                    owner_uid=owner_uid,
                    owner_name=owner_name,
                    expires_at=expires_at,
                )
            )
            db.session.flush()
        db.session.commit()
        return orders, None
    except IntegrityError:
        db.session.rollback()
        now = CocEditLock.now()
        conflict = (
            CocEditLock.query.filter(CocEditLock.production_order.in_(orders))
            .filter(CocEditLock.expires_at > now, CocEditLock.owner_uid != owner_uid)
            .order_by(CocEditLock.production_order)
            .first()
        )
        if conflict:
            return [], (
                f"Production order {conflict.production_order} is already being "
                f"used by {conflict.owner_name}."
            )
        return [], "Unable to acquire the production-order lock. Please retry."


def heartbeat_locks(production_orders: list[str], owner_uid: str) -> bool:
    orders = sorted({normalize_lock_key(order) for order in production_orders if normalize_lock_key(order)})
    if not orders:
        return False
    now = CocEditLock.now()
    updated = (
        CocEditLock.query.filter(CocEditLock.production_order.in_(orders))
        .filter(CocEditLock.owner_uid == owner_uid, CocEditLock.expires_at > now)
        .update(
            {CocEditLock.expires_at: now + LOCK_TTL},
            synchronize_session=False,
        )
    )
    if updated != len(orders):
        db.session.rollback()
        return False
    db.session.commit()
    return True


def release_locks(production_orders: list[str], owner_uid: str) -> None:
    orders = sorted({
        normalize_lock_key(order)
        for order in production_orders
        if normalize_lock_key(order)
    })
    if not orders:
        return

    CocEditLock.query.filter(
        CocEditLock.production_order.in_(orders),
        CocEditLock.owner_uid == owner_uid,
    ).delete(synchronize_session=False)
    db.session.commit()


def report_lock_conflict(report, owner_uid: str) -> str | None:
    return production_order_lock_conflict(report_production_orders(report), owner_uid)


def production_order_lock_conflict(orders: list[str], owner_uid: str) -> str | None:
    if not orders:
        return None
    now = CocEditLock.now()
    normalized = sorted({
        normalize_lock_key(order)
        for order in orders
        if normalize_lock_key(order)
    })
    for order in normalized:
        conflict = (
            CocEditLock.query.filter_by(production_order=order)
            .filter(CocEditLock.expires_at > now, CocEditLock.owner_uid != owner_uid)
            .order_by(CocEditLock.expires_at.desc())
            .first()
        )
        if conflict:
            return f"Production order {order} is being edited by {conflict.owner_name}."

        active_lock = (
            CocEditLock.query.filter_by(production_order=order)
            .filter(CocEditLock.expires_at > now)
            .first()
        )
        if not active_lock:
            return f"Production order {order} has no active editor lock. Reopen the report."
    return None
