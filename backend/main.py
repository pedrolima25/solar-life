import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import models  # noqa: F401  (registra as tabelas)
from database import Base, SessionLocal, engine
from routes import core, operations, public
from seed import migrate, seed

PRODUCTION = os.getenv("ENV", "").lower() == "production"

# Em produção a documentação interativa (/docs) fica desligada
app = FastAPI(title="Solar Life — API", version="1.0.0",
              docs_url=None if PRODUCTION else "/docs", redoc_url=None,
              openapi_url=None if PRODUCTION else "/openapi.json")

CORS_ORIGINS = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
if PRODUCTION and "*" in CORS_ORIGINS:
    raise RuntimeError("Em produção defina CORS_ORIGINS com o endereço do site (ex.: https://solarlife.vercel.app).")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Nomes dos campos para as mensagens de validação
ROTULOS = {
    "name": "Nome", "nome": "Nome", "email": "E-mail", "phone": "Telefone", "document": "CPF/CNPJ", "cnpj": "CNPJ",
    "cep": "CEP", "state": "UF", "password": "Senha", "role": "Função", "person_type": "Tipo de pessoa",
    "title": "Título", "description": "Descrição", "amount": "Valor", "value": "Valor", "due_date": "Vencimento",
    "kind": "Tipo", "quantity": "Quantidade", "unit_price": "Preço", "unit": "Unidade", "discount": "Desconto",
    "validity_days": "Validade", "installments": "Parcelas", "duration_min": "Duração", "start": "Data e hora",
    "frequency_months": "Frequência", "next_date": "Próxima data", "client_id": "Cliente", "warranty_days": "Garantia",
    "tarifa_kwh": "Tarifa", "hsp_padrao": "HSP", "custo_kwp": "Preço por kWp", "potencia_modulo_w": "Potência do módulo",
    "consumo_kwh": "Consumo", "valor_investimento": "Valor do investimento", "qtd_paineis": "Quantidade de painéis",
    "qtd_baterias": "Quantidade de baterias", "potencia_inversor_kw": "Potência do inversor",
}

_MSG = {
    "missing": ": campo obrigatório", "string_too_short": ": campo obrigatório", "greater_than": "deve ser maior que {gt}",
    "greater_than_equal": "deve ser no mínimo {ge}", "less_than_equal": "deve ser no máximo {le}",
    "less_than": "deve ser menor que {lt}", "string_pattern_mismatch": "tem um valor inválido",
    "float_parsing": "deve ser um número", "int_parsing": "deve ser um número inteiro",
    "date_from_datetime_parsing": "deve ser uma data válida", "date_parsing": "deve ser uma data válida",
    "datetime_parsing": "deve ser uma data e hora válidas", "string_too_long": "é longo demais",
}


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    """Transforma os erros de validação em frases em português (ex.: "Valor deve ser maior que 0")."""
    frases = []
    for e in exc.errors():
        loc = [str(x) for x in e.get("loc", []) if x not in ("body", "query", "path")]
        campo = ROTULOS.get(loc[-1], loc[-1]) if loc else ""
        if loc[:1] == ["items"] and len(loc) >= 2 and loc[1].isdigit():
            campo = f"Item {int(loc[1]) + 1}" + (f" — {ROTULOS.get(loc[-1], loc[-1])}" if len(loc) > 2 else "")
        msg = e.get("msg", "")
        if e.get("type") == "value_error":
            texto = msg.removeprefix("Value error, ")
            frase = f"{campo}: {texto}" if texto == "Campo obrigatório." and campo else texto
        else:
            modelo = _MSG.get(e.get("type", ""))
            # 0.0 → "0", 1.5 → "1,5"
            ctx = {k: (f"{x:g}".replace(".", ",") if isinstance(x, (int, float)) else x) for k, x in (e.get("ctx") or {}).items()}
            texto = modelo.format(**ctx) if modelo else ""
            frase = (f"{campo}{texto}." if texto.startswith(":") else f"{campo} {texto}.") if modelo and campo else f"{campo}: {msg}".strip(": ")
        if frase not in frases:
            frases.append(frase)
    return JSONResponse(status_code=422, content={"detail": " ".join(frases) or "Dados inválidos."})


app.include_router(core.router)
app.include_router(operations.router)
app.include_router(public.router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    migrate(engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}
