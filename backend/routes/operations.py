"""Orçamentos, ordens de serviço, manutenção, agenda, financeiro, dashboard e dimensionamento."""
import calendar
import datetime as dt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, true
from sqlalchemy.orm import Session

import models
import schemas as s
from auth import ADMIN, GESTAO, TECNICO, current_user, roles
from database import get_db
from routes.common import apply, get_or_404, next_number, set_items
from routes.core import company
from solar import SEM_BATERIA, dimensionar, kwp

router = APIRouter(dependencies=[Depends(current_user)])

OS_STATUS = ["Aberta", "Agendada", "Em Execução", "Aguardando Material", "Concluída", "Cancelada"]


def add_months(d: dt.date, months: int) -> dt.date:
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    return dt.date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


# ── Dimensionamento solar ───────────────────────────────────────
@router.post("/solar/sizing", dependencies=[Depends(roles(*GESTAO))])
def solar_sizing(data: s.SizingIn, db: Session = Depends(get_db)):
    c = company(db)
    hsp = data.hsp
    if not hsp:
        # Off-Grid é dimensionado pelo pior mês (sem rede para complementar)
        hsp = min(c.hsp_mensal) if data.tipo_sistema == "Off-Grid" and c.hsp_mensal else c.hsp_padrao
    try:
        return dimensionar(
            consumo_kwh=data.consumo_kwh,
            qtd_paineis=data.qtd_paineis,
            qtd_baterias=data.qtd_baterias,
            tipo_ligacao=data.tipo_ligacao,
            hsp=hsp,
            potencia_modulo_w=data.potencia_modulo_w or c.potencia_modulo_w,
            tarifa_kwh=data.tarifa_kwh or c.tarifa_kwh,
            custo_kwp=data.custo_kwp or c.custo_kwp,
            eficiencia=data.eficiencia,
            reajuste_anual=data.reajuste_anual,
            tipo_sistema=data.tipo_sistema,
            tipo_bateria=data.tipo_bateria,
            autonomia_dias=data.autonomia_dias,
            carga_essencial_kw=data.carga_essencial_kw,
            horas_backup=data.horas_backup,
            tensao_banco=data.tensao_banco,
            custo_bateria_kwh=c.custo_bateria_kwh or 2800.0,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Orçamentos ──────────────────────────────────────────────────
@router.get("/quotes", response_model=List[s.QuoteOut], dependencies=[Depends(roles(*GESTAO))])
def list_quotes(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Quote)
    if status:
        query = query.filter_by(status=status)
    return query.order_by(models.Quote.created_at.desc()).all()


@router.get("/quotes/{qid}", response_model=s.QuoteOut, dependencies=[Depends(roles(*GESTAO))])
def get_quote(qid: str, db: Session = Depends(get_db)):
    return get_or_404(db, models.Quote, qid, "Orçamento")


_TIPO_BATERIA = {"Lítio": "litio", "Chumbo-ácido": "chumbo", SEM_BATERIA: "sem"}


def _gerador_e_baterias(q: models.Quote, sz: Optional[dict]):
    """Grava painéis, kWp e baterias do dimensionamento nas colunas do orçamento e valida as baterias."""
    sz = sz or {}
    q.qtd_paineis = sz.get("num_modulos") or None
    q.potencia_painel_w = sz.get("potencia_modulo_w") or None
    q.kwp = kwp(q.qtd_paineis, q.potencia_painel_w) if q.qtd_paineis and q.potencia_painel_w else None
    if sz.get("tipo_sistema") in ("Off-Grid", "Híbrido"):
        q.tipo_bateria = _TIPO_BATERIA.get(sz.get("tipo_bateria"), "litio")
        q.qtd_baterias = int(sz.get("num_baterias") or 0)
    else:
        q.tipo_bateria, q.qtd_baterias = None, None
    if q.tipo_bateria == "sem" and q.qtd_baterias != 0:
        raise HTTPException(400, "Com “Sem bateria”, a quantidade de baterias deve ser 0.")
    if q.tipo_bateria in ("chumbo", "litio") and not q.qtd_baterias:
        raise HTTPException(400, "Informe a quantidade de baterias (maior que zero) ou escolha “Sem bateria”.")


def _save_quote(q: models.Quote, data: s.QuoteIn):
    apply(q, data.model_dump(exclude={"items"}))
    _gerador_e_baterias(q, data.sizing)
    q.subtotal = set_items(q, models.QuoteItem, data.items)
    q.total = round(max(q.subtotal - (data.discount or 0), 0), 2)


@router.post("/quotes", response_model=s.QuoteOut, dependencies=[Depends(roles(*GESTAO))])
def create_quote(data: s.QuoteIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    q = models.Quote(number=next_number(db, models.Quote))
    _save_quote(q, data)
    q.seller_id = data.seller_id or user.id
    db.add(q)
    db.commit()
    return q


@router.put("/quotes/{qid}", response_model=s.QuoteOut, dependencies=[Depends(roles(*GESTAO))])
def update_quote(qid: str, data: s.QuoteIn, db: Session = Depends(get_db)):
    q = get_or_404(db, models.Quote, qid, "Orçamento")
    if q.status == "Aprovado":
        raise HTTPException(400, "Orçamento aprovado não pode ser alterado.")
    _save_quote(q, data)
    db.commit()
    return q


@router.post("/quotes/{qid}/approve", response_model=s.QuoteOut, dependencies=[Depends(roles(*GESTAO))])
def approve_quote(qid: str, data: s.ApproveIn, db: Session = Depends(get_db)):
    q = get_or_404(db, models.Quote, qid, "Orçamento")
    if q.status == "Aprovado":
        raise HTTPException(400, "Orçamento já aprovado.")
    q.status = "Aprovado"
    q.approved_at = dt.datetime.now()

    if data.create_os:
        client = q.client
        address = ", ".join(x for x in [client.address, client.number, client.neighborhood, client.city] if x)
        o = models.ServiceOrder(
            number=next_number(db, models.ServiceOrder), client_id=q.client_id,
            installation_id=q.installation_id, quote_id=q.id, service_type=q.service_type,
            status="Aberta", service_address=address, problem=q.notes, total=q.total,
            checklist=None,
        )
        for it in q.items:
            o.items.append(models.ServiceOrderItem(product_id=it.product_id, description=it.description,
                                                   quantity=it.quantity, unit_price=it.unit_price,
                                                   component=it.component, qty_label=it.qty_label,
                                                   position=it.position))
        if q.discount:
            o.items.append(models.ServiceOrderItem(description="Desconto", quantity=1, unit_price=-q.discount,
                                                   position=len(q.items)))
        db.add(o)
        db.flush()
        q.os_id = o.id

    if data.create_receivable and q.total > 0:
        n = max(data.installments, 1)
        first = data.first_due or dt.date.today()
        parcela = round(q.total / n, 2)
        for i in range(n):
            amount = parcela if i < n - 1 else round(q.total - parcela * (n - 1), 2)
            db.add(models.FinanceEntry(
                kind="receita", category="Serviços", client_id=q.client_id, quote_id=q.id, os_id=q.os_id,
                description=f"Orçamento #{q.number} — {q.service_type}" + (f" ({i + 1}/{n})" if n > 1 else ""),
                amount=amount, due_date=add_months(first, i),
            ))
    db.commit()
    return q


@router.delete("/quotes/{qid}", dependencies=[Depends(roles(*GESTAO))])
def delete_quote(qid: str, db: Session = Depends(get_db)):
    q = get_or_404(db, models.Quote, qid, "Orçamento")
    if q.status == "Aprovado":
        raise HTTPException(400, "Orçamento aprovado não pode ser excluído.")
    db.delete(q)
    db.commit()
    return {"ok": True}


# ── Ordens de serviço ───────────────────────────────────────────
def _own_orders(query, user):
    if user.role == TECNICO:
        query = query.filter(or_(models.ServiceOrder.technician_id == user.id, models.ServiceOrder.technician_id.is_(None)))
    return query


def _check_own_order(o, user):
    if user.role == TECNICO and o.technician_id not in (None, user.id):
        raise HTTPException(403, "Esta OS é de outro técnico.")


@router.get("/orders", response_model=List[s.ServiceOrderOut])
def list_orders(status: Optional[str] = None, technician_id: Optional[str] = None, db: Session = Depends(get_db),
                user: models.User = Depends(current_user)):
    query = _own_orders(db.query(models.ServiceOrder), user)
    if status:
        query = query.filter_by(status=status)
    if technician_id:
        query = query.filter_by(technician_id=technician_id)
    return query.order_by(models.ServiceOrder.created_at.desc()).all()


@router.get("/orders/{oid}", response_model=s.ServiceOrderOut)
def get_order(oid: str, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    o = get_or_404(db, models.ServiceOrder, oid, "OS")
    _check_own_order(o, user)
    return o


def _deduct_stock(o: models.ServiceOrder, db: Session):
    """Baixa no estoque os materiais da OS quando ela é concluída (uma única vez)."""
    if o.stock_deducted:
        return
    for it in o.items:
        if it.product_id:
            p = db.get(models.Product, it.product_id)
            if p and not p.is_service:
                p.stock = round((p.stock or 0) - (it.quantity or 0), 3)
    o.stock_deducted = True


def _set_status(o: models.ServiceOrder, status: str, db: Session):
    if status not in OS_STATUS:
        raise HTTPException(400, f"Status inválido. Use: {', '.join(OS_STATUS)}")
    o.status = status
    if status == "Concluída":
        o.finished_at = o.finished_at or dt.datetime.now()
        _deduct_stock(o, db)
        if o.plan_id:
            plan = db.get(models.MaintenancePlan, o.plan_id)
            if plan:
                plan.last_date = dt.date.today()


def _save_order(o: models.ServiceOrder, data: s.ServiceOrderIn, db: Session):
    apply(o, data.model_dump(exclude={"items", "status"}))
    o.total = set_items(o, models.ServiceOrderItem, data.items)
    _set_status(o, data.status, db)


@router.post("/orders", response_model=s.ServiceOrderOut)
def create_order(data: s.ServiceOrderIn, db: Session = Depends(get_db)):
    o = models.ServiceOrder(number=next_number(db, models.ServiceOrder))
    db.add(o)
    _save_order(o, data, db)
    db.commit()
    return o


@router.put("/orders/{oid}", response_model=s.ServiceOrderOut)
def update_order(oid: str, data: s.ServiceOrderIn, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    o = get_or_404(db, models.ServiceOrder, oid, "OS")
    _check_own_order(o, user)
    _save_order(o, data, db)
    db.commit()
    return o


@router.patch("/orders/{oid}/status", response_model=s.ServiceOrderOut)
def order_status(oid: str, data: s.StatusIn, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    o = get_or_404(db, models.ServiceOrder, oid, "OS")
    _check_own_order(o, user)
    _set_status(o, data.status, db)
    db.commit()
    return o


@router.delete("/orders/{oid}", dependencies=[Depends(roles(ADMIN))])
def delete_order(oid: str, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, models.ServiceOrder, oid, "OS"))
    db.commit()
    return {"ok": True}


# ── Planos de manutenção ────────────────────────────────────────
@router.get("/plans", response_model=List[s.PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return db.query(models.MaintenancePlan).order_by(models.MaintenancePlan.next_date).all()


@router.post("/plans", response_model=s.PlanOut, dependencies=[Depends(roles(*GESTAO))])
def create_plan(data: s.PlanIn, db: Session = Depends(get_db)):
    p = models.MaintenancePlan(**data.model_dump())
    p.next_date = p.next_date or dt.date.today()
    db.add(p)
    db.commit()
    return p


@router.put("/plans/{pid}", response_model=s.PlanOut, dependencies=[Depends(roles(*GESTAO))])
def update_plan(pid: str, data: s.PlanIn, db: Session = Depends(get_db)):
    p = apply(get_or_404(db, models.MaintenancePlan, pid, "Plano"), data.model_dump())
    db.commit()
    return p


@router.post("/plans/{pid}/generate-os", response_model=s.ServiceOrderOut, dependencies=[Depends(roles(*GESTAO))])
def plan_generate_os(pid: str, db: Session = Depends(get_db)):
    """Gera a OS da próxima manutenção e avança a data do plano."""
    p = get_or_404(db, models.MaintenancePlan, pid, "Plano")
    client = p.client
    address = (p.installation.address if p.installation and p.installation.address else
               ", ".join(x for x in [client.address, client.number, client.neighborhood, client.city] if x))
    scheduled = dt.datetime.combine(p.next_date or dt.date.today(), dt.time(8, 0))
    o = models.ServiceOrder(
        number=next_number(db, models.ServiceOrder), client_id=p.client_id,
        installation_id=p.installation_id, plan_id=p.id, service_type=p.service_type,
        status="Agendada", scheduled_date=scheduled, service_address=address,
        problem=f"Manutenção programada: {p.title}", total=p.value or 0,
    )
    if p.value:
        o.items.append(models.ServiceOrderItem(description=p.title, quantity=1, unit_price=p.value))
    db.add(o)
    p.next_date = add_months(p.next_date or dt.date.today(), p.frequency_months or 6)
    db.commit()
    return o


@router.delete("/plans/{pid}", dependencies=[Depends(roles(ADMIN))])
def delete_plan(pid: str, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, models.MaintenancePlan, pid, "Plano"))
    db.commit()
    return {"ok": True}


# ── Agenda ──────────────────────────────────────────────────────
@router.get("/appointments", response_model=List[s.AppointmentOut])
def list_appointments(start: Optional[dt.date] = None, end: Optional[dt.date] = None, db: Session = Depends(get_db),
                      user: models.User = Depends(current_user)):
    query = db.query(models.Appointment)
    if user.role == TECNICO:
        query = query.filter(or_(models.Appointment.technician_id == user.id, models.Appointment.technician_id.is_(None)))
    if start:
        query = query.filter(models.Appointment.start >= dt.datetime.combine(start, dt.time.min))
    if end:
        query = query.filter(models.Appointment.start <= dt.datetime.combine(end, dt.time.max))
    return query.order_by(models.Appointment.start).all()


@router.post("/appointments", response_model=s.AppointmentOut)
def create_appointment(data: s.AppointmentIn, db: Session = Depends(get_db)):
    a = models.Appointment(**data.model_dump())
    db.add(a)
    db.commit()
    return a


@router.put("/appointments/{aid}", response_model=s.AppointmentOut)
def update_appointment(aid: str, data: s.AppointmentIn, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    a = get_or_404(db, models.Appointment, aid, "Agendamento")
    if user.role == TECNICO and a.technician_id not in (None, user.id):
        raise HTTPException(403, "Este compromisso é de outro técnico.")
    apply(a, data.model_dump())
    db.commit()
    return a


@router.delete("/appointments/{aid}", dependencies=[Depends(roles(*GESTAO))])
def delete_appointment(aid: str, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, models.Appointment, aid, "Agendamento"))
    db.commit()
    return {"ok": True}


# ── Financeiro ──────────────────────────────────────────────────
@router.get("/finance", response_model=List[s.FinanceOut], dependencies=[Depends(roles(ADMIN))])
def list_finance(month: Optional[str] = None, kind: Optional[str] = None, db: Session = Depends(get_db)):
    """month no formato AAAA-MM."""
    query = db.query(models.FinanceEntry)
    if month:
        y, m = map(int, month.split("-"))
        query = query.filter(models.FinanceEntry.due_date >= dt.date(y, m, 1),
                             models.FinanceEntry.due_date <= dt.date(y, m, calendar.monthrange(y, m)[1]))
    if kind:
        query = query.filter_by(kind=kind)
    return query.order_by(models.FinanceEntry.due_date).all()


@router.post("/finance", response_model=s.FinanceOut, dependencies=[Depends(roles(ADMIN))])
def create_finance(data: s.FinanceIn, db: Session = Depends(get_db)):
    f = models.FinanceEntry(**data.model_dump())
    if f.paid and not f.paid_date:
        f.paid_date = dt.date.today()
    db.add(f)
    db.commit()
    return f


@router.put("/finance/{fid}", response_model=s.FinanceOut, dependencies=[Depends(roles(ADMIN))])
def update_finance(fid: str, data: s.FinanceIn, db: Session = Depends(get_db)):
    f = apply(get_or_404(db, models.FinanceEntry, fid, "Lançamento"), data.model_dump())
    if f.paid and not f.paid_date:
        f.paid_date = dt.date.today()
    if not f.paid:
        f.paid_date = None
    db.commit()
    return f


@router.delete("/finance/{fid}", dependencies=[Depends(roles(ADMIN))])
def delete_finance(fid: str, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, models.FinanceEntry, fid, "Lançamento"))
    db.commit()
    return {"ok": True}


# ── Dashboard ───────────────────────────────────────────────────
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    data = _dashboard(db, user)
    if user.role != ADMIN:  # financeiro da empresa só para o administrador
        for k in ("revenue_month", "expense_month", "receivable_month", "overdue"):
            data[k] = None
    if user.role == TECNICO:
        for k in ("quotes_open", "quotes_open_value"):
            data[k] = None
    return data


def _dashboard(db: Session, user: models.User):
    today = dt.date.today()
    month_start = today.replace(day=1)
    month_end = today.replace(day=calendar.monthrange(today.year, today.month)[1])
    F = models.FinanceEntry

    def total(*filters):
        return round(db.query(func.coalesce(func.sum(F.amount), 0)).filter(*filters).scalar() or 0, 2)

    by_status = dict(_own_orders(db.query(models.ServiceOrder.status, func.count()), user)
                     .group_by(models.ServiceOrder.status).all())
    in_month = (F.due_date >= month_start, F.due_date <= month_end)
    upcoming = (db.query(models.Appointment)
                .filter(models.Appointment.start >= dt.datetime.combine(today, dt.time.min),
                        models.Appointment.status == "Agendado",
                        or_(models.Appointment.technician_id == user.id, models.Appointment.technician_id.is_(None))
                        if user.role == TECNICO else true())
                .order_by(models.Appointment.start).limit(6).all())
    due_plans = (db.query(models.MaintenancePlan)
                 .filter(models.MaintenancePlan.active == True,  # noqa: E712
                         models.MaintenancePlan.next_date <= today + dt.timedelta(days=15))
                 .order_by(models.MaintenancePlan.next_date).all())
    low_stock = (db.query(models.Product)
                 .filter(models.Product.is_service == False, models.Product.stock <= models.Product.min_stock,  # noqa: E712
                         models.Product.min_stock > 0).all())
    kwp = db.query(func.coalesce(func.sum(models.Installation.potencia_kwp), 0)).scalar() or 0

    return {
        "orders_by_status": by_status,
        "open_orders": sum(v for k, v in by_status.items() if k not in ("Concluída", "Cancelada")),
        "clients": db.query(func.count(models.Client.id)).scalar(),
        "installations": db.query(func.count(models.Installation.id)).scalar(),
        "kwp_installed": round(kwp, 2),
        "quotes_open": db.query(func.count(models.Quote.id)).filter(models.Quote.status.in_(["Rascunho", "Enviado"])).scalar(),
        "quotes_open_value": round(db.query(func.coalesce(func.sum(models.Quote.total), 0))
                                   .filter(models.Quote.status.in_(["Rascunho", "Enviado"])).scalar() or 0, 2),
        "revenue_month": total(F.kind == "receita", F.paid == True, F.paid_date >= month_start, F.paid_date <= month_end),  # noqa: E712
        "expense_month": total(F.kind == "despesa", F.paid == True, F.paid_date >= month_start, F.paid_date <= month_end),  # noqa: E712
        "receivable_month": total(F.kind == "receita", F.paid == False, *in_month),  # noqa: E712
        "overdue": total(F.paid == False, F.kind == "receita", F.due_date < today),  # noqa: E712
        "upcoming": [{"id": a.id, "title": a.title, "type": a.type, "start": a.start,
                      "client": a.client.name if a.client else None,
                      "technician": a.technician.name if a.technician else None} for a in upcoming],
        "due_plans": [{"id": p.id, "title": p.title, "next_date": p.next_date,
                       "client": p.client.name, "overdue": p.next_date < today} for p in due_plans],
        "low_stock": [{"id": p.id, "name": p.name, "stock": p.stock, "min_stock": p.min_stock, "unit": p.unit}
                      for p in low_stock],
    }
