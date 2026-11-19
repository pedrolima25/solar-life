import datetime as dt
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Ref(ORM):
    id: str
    name: str


# ── Auth / usuários ─────────────────────────────────────────────
class LoginIn(BaseModel):
    email: str
    password: str


class UserIn(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: str = "tecnico"
    active: bool = True
    password: Optional[str] = None


class UserOut(ORM):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    active: bool


# ── Empresa ─────────────────────────────────────────────────────
class CompanyIn(BaseModel):
    name: str
    cnpj: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    responsavel_tecnico: Optional[str] = None
    crea: Optional[str] = None
    tarifa_kwh: float = 0.95
    hsp_padrao: float = 5.0
    custo_kwp: float = 3800.0
    potencia_modulo_w: int = 550
    slogan: Optional[str] = None
    logo: Optional[str] = None
    escopo_padrao: Optional[str] = None
    observacoes_padrao: Optional[str] = None
    hsp_mensal: Optional[List[float]] = None
    custo_bateria_kwh: float = 2800.0


class CompanyOut(CompanyIn, ORM):
    id: str


# ── Clientes ────────────────────────────────────────────────────
class ClientIn(BaseModel):
    name: str
    person_type: str = "PF"
    document: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    cep: Optional[str] = None
    address: Optional[str] = None
    number: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None


class ClientOut(ClientIn, ORM):
    id: str
    created_at: Optional[dt.datetime] = None


# ── Instalações ─────────────────────────────────────────────────
class InstallationIn(BaseModel):
    client_id: str
    name: str
    type: str = "Solar On-Grid"
    status: str = "Ativa"
    address: Optional[str] = None
    concessionaria: Optional[str] = None
    unidade_consumidora: Optional[str] = None
    tipo_ligacao: Optional[str] = None
    tensao: Optional[str] = None
    potencia_kwp: Optional[float] = None
    num_modulos: Optional[int] = None
    modulo_modelo: Optional[str] = None
    inversor_modelo: Optional[str] = None
    potencia_inversor_kw: Optional[float] = None
    geracao_estimada_kwh: Optional[float] = None
    estrutura: Optional[str] = None
    banco_baterias: Optional[str] = None
    autonomia: Optional[str] = None
    disjuntor_geral: Optional[str] = None
    description: Optional[str] = None
    installation_date: Optional[dt.date] = None
    warranty_until: Optional[dt.date] = None


class InstallationOut(InstallationIn, ORM):
    id: str
    client: Optional[Ref] = None


# ── Produtos / estoque ──────────────────────────────────────────
class ProductIn(BaseModel):
    name: str
    category: str = "Material Elétrico"
    brand: Optional[str] = None
    unit: str = "un"
    cost_price: float = 0
    sale_price: float = 0
    stock: float = 0
    min_stock: float = 0
    is_service: bool = False


class ProductOut(ProductIn, ORM):
    id: str


class StockMove(BaseModel):
    quantity: float  # positivo = entrada, negativo = saída


# ── Itens (orçamento / OS) ──────────────────────────────────────
class ItemIn(BaseModel):
    product_id: Optional[str] = None
    description: str
    quantity: float = 1
    unit_price: float = 0
    component: Optional[str] = None
    qty_label: Optional[str] = None


class ItemOut(ItemIn, ORM):
    id: str


# ── Orçamentos ──────────────────────────────────────────────────
class QuoteIn(BaseModel):
    client_id: str
    seller_id: Optional[str] = None
    installation_id: Optional[str] = None
    service_type: str = "Instalação Solar"
    status: str = "Rascunho"
    sizing: Optional[dict] = None
    discount: float = 0
    payment_terms: Optional[str] = None
    validity_days: int = 15
    notes: Optional[str] = None
    local_instalacao: Optional[str] = None
    potencia_kwp: Optional[float] = None
    items: List[ItemIn] = []


class QuoteOut(ORM):
    id: str
    number: Optional[int] = None
    client_id: str
    seller_id: Optional[str] = None
    installation_id: Optional[str] = None
    service_type: str
    status: str
    sizing: Optional[dict] = None
    subtotal: float
    discount: float
    total: float
    payment_terms: Optional[str] = None
    validity_days: int
    notes: Optional[str] = None
    local_instalacao: Optional[str] = None
    potencia_kwp: Optional[float] = None
    qtd_paineis: Optional[int] = None
    potencia_painel_w: Optional[int] = None
    kwp: Optional[float] = None
    tipo_bateria: Optional[str] = None
    qtd_baterias: Optional[int] = None
    os_id: Optional[str] = None
    created_at: Optional[dt.datetime] = None
    approved_at: Optional[dt.datetime] = None
    share_token: Optional[str] = None
    share_views: Optional[int] = 0
    share_last_view: Optional[dt.datetime] = None
    client: Optional[Ref] = None
    items: List[ItemOut] = []


class ApproveIn(BaseModel):
    create_os: bool = True
    create_receivable: bool = True
    installments: int = 1
    first_due: Optional[dt.date] = None


# ── Ordens de serviço ───────────────────────────────────────────
class ServiceOrderIn(BaseModel):
    client_id: str
    installation_id: Optional[str] = None
    technician_id: Optional[str] = None
    service_type: str = "Manutenção Corretiva"
    priority: str = "Normal"
    status: str = "Aberta"
    service_address: Optional[str] = None
    scheduled_date: Optional[dt.datetime] = None
    problem: Optional[str] = None
    diagnosis: Optional[str] = None
    solution: Optional[str] = None
    checklist: Optional[List[dict]] = None
    measurements: Optional[dict] = None
    warranty_days: int = 90
    art_number: Optional[str] = None
    items: List[ItemIn] = []


class ServiceOrderOut(ORM):
    id: str
    number: Optional[int] = None
    client_id: str
    installation_id: Optional[str] = None
    technician_id: Optional[str] = None
    quote_id: Optional[str] = None
    plan_id: Optional[str] = None
    service_type: str
    priority: str
    status: str
    service_address: Optional[str] = None
    scheduled_date: Optional[dt.datetime] = None
    problem: Optional[str] = None
    diagnosis: Optional[str] = None
    solution: Optional[str] = None
    checklist: Optional[List[dict]] = None
    measurements: Optional[dict] = None
    warranty_days: int
    art_number: Optional[str] = None
    total: float
    paid: bool
    created_at: Optional[dt.datetime] = None
    finished_at: Optional[dt.datetime] = None
    client: Optional[Ref] = None
    installation: Optional[Ref] = None
    technician: Optional[Ref] = None
    items: List[ItemOut] = []


class StatusIn(BaseModel):
    status: str


# ── Manutenção ──────────────────────────────────────────────────
class PlanIn(BaseModel):
    client_id: str
    installation_id: Optional[str] = None
    title: str
    service_type: str = "Manutenção Preventiva"
    frequency_months: int = 6
    value: float = 0
    next_date: Optional[dt.date] = None
    active: bool = True
    notes: Optional[str] = None


class PlanOut(PlanIn, ORM):
    id: str
    last_date: Optional[dt.date] = None
    client: Optional[Ref] = None
    installation: Optional[Ref] = None


# ── Agenda ──────────────────────────────────────────────────────
class AppointmentIn(BaseModel):
    title: str
    type: str = "Visita Técnica"
    client_id: Optional[str] = None
    technician_id: Optional[str] = None
    os_id: Optional[str] = None
    start: dt.datetime
    duration_min: int = 60
    status: str = "Agendado"
    notes: Optional[str] = None


class AppointmentOut(AppointmentIn, ORM):
    id: str
    client: Optional[Ref] = None
    technician: Optional[Ref] = None


# ── Financeiro ──────────────────────────────────────────────────
class FinanceIn(BaseModel):
    kind: str
    description: str
    category: str = "Serviços"
    amount: float
    due_date: dt.date
    paid: bool = False
    paid_date: Optional[dt.date] = None
    payment_method: Optional[str] = None
    client_id: Optional[str] = None


class FinanceOut(FinanceIn, ORM):
    id: str
    os_id: Optional[str] = None
    quote_id: Optional[str] = None
    client: Optional[Ref] = None


# ── Dimensionamento solar ───────────────────────────────────────
class SizingIn(BaseModel):
    consumo_kwh: float
    tipo_ligacao: str = "Bifásico"
    hsp: Optional[float] = None
    potencia_modulo_w: Optional[int] = None
    tarifa_kwh: Optional[float] = None
    custo_kwp: Optional[float] = None
    eficiencia: float = 0.80
    reajuste_anual: float = 0.06
    tipo_sistema: str = "On-Grid"          # On-Grid | Off-Grid | Híbrido
    tipo_bateria: str = "Lítio"            # Lítio | Chumbo-ácido | Sem bateria (só Híbrido)
    autonomia_dias: float = 1.0            # Off-Grid: dias sem sol cobertos pela bateria
    carga_essencial_kw: float = 1.5        # Híbrido: cargas mantidas quando falta luz
    horas_backup: float = 4.0              # Híbrido: horas de reserva
    tensao_banco: int = 48
    qtd_paineis: Optional[int] = Field(None, ge=0)    # vazio = calculado pelo consumo
    qtd_baterias: Optional[int] = Field(None, ge=0)   # vazio = calculado pela autonomia/reserva


AnyDict = dict[str, Any]
