"""Link público do orçamento: o cliente abre a apresentação sem login.

O token é aleatório e longo (impossível de adivinhar). A resposta traz só o necessário
para a apresentação — sem CPF, telefone, e-mail do cliente nem preço de custo dos produtos.
"""
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from auth import GESTAO, roles
from database import get_db
from models import now
from routes.common import get_or_404
from routes.core import company

router = APIRouter()


@router.post("/quotes/{qid}/share", dependencies=[Depends(roles(*GESTAO))])
def share_quote(qid: str, db: Session = Depends(get_db)):
    """Gera (ou reaproveita) o link público do orçamento."""
    q = get_or_404(db, models.Quote, qid, "Orçamento")
    if not q.share_token:
        q.share_token = secrets.token_urlsafe(18)
        if q.status == "Rascunho":
            q.status = "Enviado"
        db.commit()
    return {"token": q.share_token, "views": q.share_views or 0, "last_view": q.share_last_view}


@router.delete("/quotes/{qid}/share", dependencies=[Depends(roles(*GESTAO))])
def unshare_quote(qid: str, db: Session = Depends(get_db)):
    """Desativa o link (quem tiver o link antigo deixa de conseguir abrir)."""
    q = get_or_404(db, models.Quote, qid, "Orçamento")
    q.share_token = None
    db.commit()
    return {"ok": True}


@router.get("/public/quotes/{token}")
def public_quote(token: str, db: Session = Depends(get_db)):
    if not token or len(token) < 16:
        raise HTTPException(404, "Proposta não encontrada.")
    q = db.query(models.Quote).filter_by(share_token=token).first()
    if not q:
        raise HTTPException(404, "Proposta não encontrada ou link desativado.")

    q.share_views = (q.share_views or 0) + 1
    q.share_last_view = now()
    db.commit()

    c = company(db)
    products = {p.id: p for p in db.query(models.Product).filter(
        models.Product.id.in_([it.product_id for it in q.items if it.product_id])).all()}
    return {
        "quote": {
            "id": q.id, "number": q.number, "status": q.status, "service_type": q.service_type,
            "sizing": q.sizing, "subtotal": q.subtotal, "discount": q.discount, "total": q.total,
            "payment_terms": q.payment_terms, "validity_days": q.validity_days, "notes": q.notes,
            "local_instalacao": q.local_instalacao, "potencia_kwp": q.potencia_kwp, "created_at": q.created_at,
            "items": [{
                "description": it.description, "quantity": it.quantity, "component": it.component,
                "qty_label": it.qty_label, "category": products[it.product_id].category if it.product_id in products else None,
                "unit": products[it.product_id].unit if it.product_id in products else None,
            } for it in q.items],
        },
        # Só o nome e a cidade do cliente
        "client": {"name": q.client.name, "city": q.client.city, "state": q.client.state},
        "company": {
            "name": c.name, "slogan": c.slogan, "phone": c.phone, "email": c.email, "logo": c.logo,
            "tarifa_kwh": c.tarifa_kwh, "hsp_padrao": c.hsp_padrao, "hsp_mensal": c.hsp_mensal,
            "responsavel_tecnico": c.responsavel_tecnico, "escopo_padrao": c.escopo_padrao,
            "observacoes_padrao": c.observacoes_padrao,
        },
    }
