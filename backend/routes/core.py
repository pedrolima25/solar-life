"""Autenticação, usuários, empresa, clientes, instalações e estoque."""
from typing import List, Optional

import time

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
import schemas as s
from auth import ADMIN, GESTAO, TECNICO, admin_only, create_token, current_user, hash_password, roles, verify_password
from database import get_db
from routes.common import apply, get_or_404

router = APIRouter()
protected = APIRouter(dependencies=[Depends(current_user)])


# ── Auth ────────────────────────────────────────────────────────
_FALHAS: dict[str, list[float]] = {}
_MAX_FALHAS, _JANELA_S = 5, 15 * 60


def _login(email: str, password: str, db: Session, ip: str = ""):
    chave = f"{ip}|{email.strip().lower()}"
    agora = time.time()
    recentes = [t for t in _FALHAS.get(chave, []) if agora - t < _JANELA_S]
    if len(recentes) >= _MAX_FALHAS:
        espera = int((_JANELA_S - (agora - recentes[0])) / 60) + 1
        raise HTTPException(429, f"Muitas tentativas de senha. Tente de novo em {espera} min.")
    user = db.query(models.User).filter(models.User.email == email.strip().lower()).first()
    if not user or not user.active or not verify_password(password, user.password_hash):
        _FALHAS[chave] = recentes + [agora]
        raise HTTPException(401, "E-mail ou senha incorretos.")
    _FALHAS.pop(chave, None)
    return {"access_token": create_token(user), "token_type": "bearer", "user": s.UserOut.model_validate(user)}


@router.post("/auth/login")
def login(data: s.LoginIn, request: Request, db: Session = Depends(get_db)):
    return _login(data.email, data.password, db, _client_ip(request))


@router.post("/auth/token")
def login_form(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login no formato OAuth2 (usado pelo botão Authorize do /docs)."""
    return _login(form.username, form.password, db, _client_ip(request))


def _client_ip(request: Request) -> str:
    # Atrás do proxy do Render o IP real vem no X-Forwarded-For
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "")


@router.get("/auth/me", response_model=s.UserOut)
def me(user: models.User = Depends(current_user)):
    return user


# ── Usuários ────────────────────────────────────────────────────
@protected.get("/users", response_model=List[s.UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.name).all()


@router.post("/users", response_model=s.UserOut, dependencies=[Depends(admin_only)])
def create_user(data: s.UserIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(400, "Já existe um usuário com este e-mail.")
    if not data.password:
        raise HTTPException(400, "Informe uma senha.")
    user = models.User(**data.model_dump(exclude={"password", "email"}), email=email,
                       password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    return user


@router.put("/users/{user_id}", response_model=s.UserOut, dependencies=[Depends(admin_only)])
def update_user(user_id: str, data: s.UserIn, db: Session = Depends(get_db)):
    user = get_or_404(db, models.User, user_id, "Usuário")
    apply(user, data.model_dump(exclude={"password", "email"}))
    user.email = data.email.strip().lower()
    if data.password:
        user.password_hash = hash_password(data.password)
    db.commit()
    return user


# ── Empresa ─────────────────────────────────────────────────────
def company(db: Session) -> models.Company:
    c = db.query(models.Company).first()
    if not c:
        c = models.Company()
        db.add(c)
        db.commit()
    return c


@protected.get("/company", response_model=s.CompanyOut)
def get_company(db: Session = Depends(get_db)):
    return company(db)


@router.put("/company", response_model=s.CompanyOut, dependencies=[Depends(admin_only)])
def update_company(data: s.CompanyIn, db: Session = Depends(get_db)):
    c = apply(company(db), data.model_dump())
    db.commit()
    return c


# ── Clientes ────────────────────────────────────────────────────
@protected.get("/clients", response_model=List[s.ClientOut])
def list_clients(q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Client)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(models.Client.name.ilike(like), models.Client.document.ilike(like),
                                 models.Client.phone.ilike(like), models.Client.city.ilike(like)))
    return query.order_by(models.Client.name).all()


@protected.post("/clients", response_model=s.ClientOut, dependencies=[Depends(roles(*GESTAO))])
def create_client(data: s.ClientIn, db: Session = Depends(get_db)):
    c = models.Client(**data.model_dump())
    db.add(c)
    db.commit()
    return c


@protected.get("/clients/{client_id}")
def client_detail(client_id: str, db: Session = Depends(get_db), user: models.User = Depends(current_user)):
    c = get_or_404(db, models.Client, client_id, "Cliente")
    orders = db.query(models.ServiceOrder).filter_by(client_id=client_id).order_by(models.ServiceOrder.created_at.desc()).all()
    quotes = db.query(models.Quote).filter_by(client_id=client_id).order_by(models.Quote.created_at.desc()).all()
    return {
        "client": s.ClientOut.model_validate(c),
        "installations": [s.InstallationOut.model_validate(i) for i in c.installations],
        "orders": [{"id": o.id, "number": o.number, "service_type": o.service_type, "status": o.status,
                    "total": o.total, "created_at": o.created_at} for o in orders],
        "quotes": [{"id": q.id, "number": q.number, "service_type": q.service_type, "status": q.status,
                    "total": q.total, "created_at": q.created_at} for q in quotes] if user.role != TECNICO else [],
    }


@protected.put("/clients/{client_id}", response_model=s.ClientOut, dependencies=[Depends(roles(*GESTAO))])
def update_client(client_id: str, data: s.ClientIn, db: Session = Depends(get_db)):
    c = apply(get_or_404(db, models.Client, client_id, "Cliente"), data.model_dump())
    db.commit()
    return c


@protected.delete("/clients/{client_id}", dependencies=[Depends(roles(ADMIN))])
def delete_client(client_id: str, db: Session = Depends(get_db)):
    c = get_or_404(db, models.Client, client_id, "Cliente")
    if db.query(models.ServiceOrder).filter_by(client_id=client_id).first() or \
       db.query(models.Quote).filter_by(client_id=client_id).first():
        raise HTTPException(400, "Cliente possui orçamentos ou ordens de serviço e não pode ser excluído.")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ── Instalações ─────────────────────────────────────────────────
@protected.get("/installations", response_model=List[s.InstallationOut])
def list_installations(client_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Installation)
    if client_id:
        query = query.filter_by(client_id=client_id)
    return query.order_by(models.Installation.created_at.desc()).all()


@protected.post("/installations", response_model=s.InstallationOut)
def create_installation(data: s.InstallationIn, db: Session = Depends(get_db)):
    i = models.Installation(**data.model_dump())
    db.add(i)
    db.commit()
    return i


@protected.put("/installations/{inst_id}", response_model=s.InstallationOut)
def update_installation(inst_id: str, data: s.InstallationIn, db: Session = Depends(get_db)):
    i = apply(get_or_404(db, models.Installation, inst_id, "Instalação"), data.model_dump())
    db.commit()
    return i


@protected.delete("/installations/{inst_id}", dependencies=[Depends(roles(ADMIN))])
def delete_installation(inst_id: str, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, models.Installation, inst_id, "Instalação"))
    db.commit()
    return {"ok": True}


# ── Produtos / estoque ──────────────────────────────────────────
@protected.get("/products", response_model=List[s.ProductOut])
def list_products(q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Product)
    if q:
        query = query.filter(models.Product.name.ilike(f"%{q}%"))
    return query.order_by(models.Product.category, models.Product.name).all()


@protected.post("/products", response_model=s.ProductOut, dependencies=[Depends(roles(ADMIN))])
def create_product(data: s.ProductIn, db: Session = Depends(get_db)):
    p = models.Product(**data.model_dump())
    db.add(p)
    db.commit()
    return p


@protected.put("/products/{pid}", response_model=s.ProductOut, dependencies=[Depends(roles(ADMIN))])
def update_product(pid: str, data: s.ProductIn, db: Session = Depends(get_db)):
    p = apply(get_or_404(db, models.Product, pid, "Produto"), data.model_dump())
    db.commit()
    return p


@protected.post("/products/{pid}/move", response_model=s.ProductOut, dependencies=[Depends(roles(*GESTAO))])
def move_stock(pid: str, data: s.StockMove, db: Session = Depends(get_db)):
    p = get_or_404(db, models.Product, pid, "Produto")
    p.stock = round((p.stock or 0) + data.quantity, 3)
    db.commit()
    return p


@protected.delete("/products/{pid}", dependencies=[Depends(roles(ADMIN))])
def delete_product(pid: str, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, models.Product, pid, "Produto"))
    db.commit()
    return {"ok": True}


# ── Marcas de inversor e painel ─────────────────────────────────
@protected.get("/marcas", response_model=List[s.BrandOut])
def list_brands(tipo: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Brand)
    if tipo:
        query = query.filter_by(tipo=tipo)
    return query.order_by(models.Brand.tipo, models.Brand.nome).all()


@protected.post("/marcas", response_model=s.BrandOut, dependencies=[Depends(roles(*GESTAO))])
def create_brand(data: s.BrandIn, db: Session = Depends(get_db)):
    """Cria a marca ou devolve a existente com o mesmo nome (reativando-a), para a opção “Outra”."""
    nome = " ".join(data.nome.split())
    m = db.query(models.Brand).filter(models.Brand.tipo == data.tipo,
                                      func.lower(models.Brand.nome) == nome.lower()).first()
    if m:
        m.ativo = True
    else:
        m = models.Brand(nome=nome, tipo=data.tipo, ativo=True)
        db.add(m)
    db.commit()
    return m


@protected.put("/marcas/{mid}", response_model=s.BrandOut, dependencies=[Depends(roles(ADMIN))])
def update_brand(mid: str, data: s.BrandIn, db: Session = Depends(get_db)):
    m = get_or_404(db, models.Brand, mid, "Marca")
    nome = " ".join(data.nome.split())
    dup = db.query(models.Brand).filter(models.Brand.id != mid, models.Brand.tipo == data.tipo,
                                        func.lower(models.Brand.nome) == nome.lower()).first()
    if dup:
        raise HTTPException(400, "Já existe uma marca com esse nome.")
    m.nome, m.tipo, m.ativo = nome, data.tipo, data.ativo
    db.commit()
    return m


router.include_router(protected)
