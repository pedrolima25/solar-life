"""Cria o administrador inicial e um catálogo básico de materiais/serviços."""
import os

from sqlalchemy.orm import Session

import models
from auth import hash_password

PRODUTOS = [
    # nome, categoria, unidade, custo, venda, serviço?
    ("Módulo Fotovoltaico 550 W", "Módulo Solar", "un", 620, 850, False),
    ("Inversor On-Grid 5 kW", "Inversor", "un", 4200, 5600, False),
    ("Inversor On-Grid 8 kW", "Inversor", "un", 6100, 7900, False),
    ("Estrutura p/ telhado cerâmico (4 módulos)", "Estrutura", "kit", 380, 520, False),
    ("Cabo solar 6 mm² (preto/vermelho)", "Cabos", "m", 6.5, 11, False),
    ("Conector MC4 (par)", "Conectores", "par", 9, 18, False),
    ("String Box CC 2 entradas", "Proteção", "un", 520, 780, False),
    ("Disjuntor bipolar 40 A", "Proteção", "un", 38, 65, False),
    ("DPS 275 V 20 kA", "Proteção", "un", 42, 75, False),
    ("Cabo flexível 2,5 mm²", "Cabos", "m", 2.3, 4.5, False),
    ("Cabo flexível 10 mm²", "Cabos", "m", 9.8, 16, False),
    ("Quadro de distribuição 12 disjuntores", "Material Elétrico", "un", 85, 150, False),
    ("Tomada 2P+T 10 A", "Material Elétrico", "un", 9, 18, False),
    ("Mão de obra — instalação solar (por kWp)", "Mão de Obra", "kWp", 0, 450, True),
    ("Projeto e homologação na concessionária", "Projeto", "un", 0, 1200, True),
    ("Limpeza de módulos (por módulo)", "Serviço", "un", 0, 15, True),
    ("Manutenção preventiva em usina solar", "Serviço", "un", 0, 350, True),
    ("Visita técnica / diagnóstico", "Visita Técnica", "un", 0, 150, True),
    ("Hora técnica eletricista", "Mão de Obra", "h", 0, 90, True),
    ("Laudo de instalação elétrica (NR-10 / NBR 5410)", "Projeto", "un", 0, 600, True),
]

# Off-Grid / Híbrido — adicionados também em bancos que já existiam
PRODUTOS_BATERIA = [
    ("Bateria Lítio LiFePO4 48 V 100 Ah (5,12 kWh)", "Bateria", "un", 9800, 14500, False),
    ("Bateria Estacionária 12 V 220 Ah (2,64 kWh)", "Bateria", "un", 1150, 1650, False),
    ("Inversor Off-Grid 5 kW 48 V", "Inversor", "un", 3900, 5400, False),
    ("Inversor Híbrido 5 kW 48 V", "Inversor", "un", 6900, 9200, False),
    ("Controlador de Carga MPPT 60 A 48 V", "Controlador de Carga", "un", 1100, 1600, False),
    ("Kit proteção CC para banco de baterias (fusível + disjuntor 125 A)", "Proteção", "kit", 380, 620, False),
    ("Cabo flexível 35 mm² (bateria)", "Cabos", "m", 38, 60, False),
    ("Rack / gabinete para baterias", "Estrutura", "un", 650, 980, False),
    ("Mão de obra — instalação de banco de baterias", "Mão de Obra", "un", 0, 900, True),
    ("Manutenção de banco de baterias", "Serviço", "un", 0, 400, True),
]


ESCOPO_PADRAO = (
    "Fornecimento dos equipamentos e materiais discriminados nesta proposta, montagem do sistema fotovoltaico, "
    "conexões elétricas, configuração e comissionamento do inversor e orientação básica de operação. "
    "A execução fica sujeita à vistoria e à confirmação das condições do local."
)
OBSERVACOES_PADRAO = "\n".join([
    "A geração é estimativa preliminar, não garantia de produção ou de abatimento integral da fatura.",
    "O dimensionamento definitivo depende da análise da conta de energia, vistoria do telhado, orientação, "
    "inclinação, sombreamento e condições do padrão elétrico.",
    "Adequações elétricas não discriminadas, reforços estruturais, obras civis e taxas extraordinárias, "
    "se necessárias, deverão ser avaliadas e aprovadas à parte.",
    "Garantias dos equipamentos conforme condições dos respectivos fabricantes.",
])
# Irradiação de referência (h/dia) — Boa Vista/RR, jan..dez
HSP_MENSAL_PADRAO = [4.503, 4.671, 4.990, 4.872, 4.508, 4.671, 4.788, 5.203, 5.522, 5.382, 5.040, 4.570]

EMPRESA_PADRAO = dict(
    name="Solar Life Energia Renovável",
    slogan="A energia do futuro ao seu alcance.",
    phone="(92) 99962-6328",
    email="solarlife80@gmail.com",
    responsavel_tecnico="Jaime Júnior",
    tarifa_kwh=0.80,
    potencia_modulo_w=620,
)


def migrate(engine):
    """Adiciona colunas novas em bancos já existentes (create_all não altera tabelas)."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in models.Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name not in existing:
                    ddl = col.type.compile(dialect=engine.dialect)
                    conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN "{col.name}" {ddl}'))


def _senha_admin() -> str:
    senha = os.getenv("ADMIN_PASSWORD", "")
    if os.getenv("ENV", "").lower() == "production" and len(senha) < 8:
        raise RuntimeError("Defina ADMIN_PASSWORD (mínimo 8 caracteres) para criar o administrador em produção.")
    return senha or "admin123"


def seed(db: Session):
    c = db.query(models.Company).first()
    if not c:
        c = models.Company(**EMPRESA_PADRAO)
        db.add(c)
    elif c.name in ("Minha Empresa Solar", "Solar Life") and not c.slogan:
        for k, v in EMPRESA_PADRAO.items():
            setattr(c, k, v)
    if not c.escopo_padrao:
        c.escopo_padrao = ESCOPO_PADRAO
    if not c.observacoes_padrao:
        c.observacoes_padrao = OBSERVACOES_PADRAO
    if not c.hsp_mensal:
        c.hsp_mensal = HSP_MENSAL_PADRAO
    if not c.custo_bateria_kwh:
        c.custo_bateria_kwh = 2800.0

    if not db.query(models.User).first():
        db.add(models.User(
            name="Administrador",
            email=os.getenv("ADMIN_EMAIL", "admin@solar.com"),
            password_hash=hash_password(_senha_admin()),
            role="admin",
        ))

    novos = PRODUTOS if not db.query(models.Product).first() else []
    if not db.query(models.Product).filter(models.Product.category == "Bateria").first():
        novos = novos + PRODUTOS_BATERIA
    if novos:
        for name, cat, unit, cost, price, service in novos:
            db.add(models.Product(name=name, category=cat, unit=unit, cost_price=cost, sale_price=price,
                                  is_service=service, stock=0 if service else 10, min_stock=0 if service else 2))
    db.commit()
