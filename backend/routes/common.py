from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session


def get_or_404(db: Session, model, obj_id: str, label: str = "Registro"):
    obj = db.get(model, obj_id)
    if not obj:
        raise HTTPException(404, f"{label} não encontrado.")
    return obj


def next_number(db: Session, model) -> int:
    return (db.query(func.max(model.number)).scalar() or 0) + 1


def apply(obj, data: dict):
    for key, value in data.items():
        setattr(obj, key, value)
    return obj


def set_items(obj, item_model, items):
    """Substitui os itens de um orçamento/OS e devolve o subtotal."""
    obj.items.clear()
    subtotal = 0.0
    for pos, it in enumerate(items):
        obj.items.append(item_model(**it.model_dump(), position=pos))
        subtotal += (it.quantity or 0) * (it.unit_price or 0)
    return round(subtotal, 2)
