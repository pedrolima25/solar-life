import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
