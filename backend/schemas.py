import datetime as dt
import re
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

import validators as v


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
    name: str = Field(min_length=1)
    email: str
    phone: Optional[str] = None
    role: str = Field("tecnico", pattern="^(admin|vendedor|tecnico)$")
    active: bool = True
    password: Optional[str] = None

    _phone = field_validator("phone")(v.opt_phone)

    @field_validator("email")
    @classmethod
    def _email(cls, x: str) -> str:
        if not v.opt_email(x):
            raise ValueError("Informe um e-mail válido.")
        return x.strip().lower()

    @field_validator("password")
    @classmethod
    def _password(cls, x: Optional[str]) -> Optional[str]:
        if x and len(x) < 8:
            raise ValueError("A senha deve ter pelo menos 8 caracteres.")
        return x or None


class UserOut(ORM):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    active: bool


# ── Empresa ─────────────────────────────────────────────────────
class CompanyBase(BaseModel):
    """Campos da empresa sem regras (usado na resposta, para dados antigos nunca quebrarem a leitura)."""
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


class CompanyIn(CompanyBase):
    name: str = Field(min_length=1)
    tarifa_kwh: float = Field(0.95, gt=0)
    hsp_padrao: float = Field(5.0, gt=0, le=8)
    custo_kwp: float = Field(3800.0, gt=0)
    potencia_modulo_w: int = Field(550, gt=0)
    custo_bateria_kwh: float = Field(2800.0, ge=0)

    _cnpj = field_validator("cnpj")(v.opt_cnpj)
    _phone = field_validator("phone")(v.opt_phone)
    _email = field_validator("email")(v.opt_email)


class CompanyOut(CompanyBase, ORM):
    id: str


# ── Clientes ────────────────────────────────────────────────────
class ClientBase(BaseModel):
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


class ClientIn(ClientBase):
    person_type: str = Field("PF", pattern="^(PF|PJ)$")

    _phone = field_validator("phone")(v.opt_phone)
    _email = field_validator("email")(v.opt_email)
    _cep = field_validator("cep")(v.opt_cep)

    @field_validator("name")
    @classmethod
    def _name(cls, x: str) -> str:
        if not x.strip():
            raise ValueError("Informe o nome do cliente.")
        return x.strip()

    @field_validator("state")
    @classmethod
    def _uf(cls, x: Optional[str]) -> Optional[str]:
        if not x or not x.strip():
            return None
        if not re.fullmatch(r"[A-Za-z]{2}", x.strip()):
            raise ValueError("UF deve ter 2 letras (ex.: RR).")
        return x.strip().upper()

    @model_validator(mode="after")
    def _documento(self):
        if self.document and self.document.strip():
            pj = self.person_type == "PJ"
            if not (v.cnpj_ok if pj else v.cpf_ok)(self.document):
                raise ValueError("CNPJ inválido." if pj else "CPF inválido.")
        else:
            self.document = None
        return self


class ClientOut(ClientBase, ORM):
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
class ProductBase(BaseModel):
    name: str
    category: str = "Material Elétrico"
    brand: Optional[str] = None
    unit: str = "un"
    cost_price: float = 0
    sale_price: float = 0
    stock: float = 0
    min_stock: float = 0
    is_service: bool = False


class ProductIn(ProductBase):
    _nome = field_validator("name", "unit")(v.required)

    @model_validator(mode="after")
    def _precos(self):
        for campo, label in (("cost_price", "Preço de custo"), ("sale_price", "Preço de venda"), ("min_stock", "Estoque mínimo")):
            if (getattr(self, campo) or 0) < 0:
                raise ValueError(f"{label} não pode ser negativo.")
        return self


class ProductOut(ProductBase, ORM):
    id: str


class StockMove(BaseModel):
    quantity: float  # positivo = entrada, negativo = saída


# ── Marcas (inversor / painel) ──────────────────────────────────
class BrandIn(BaseModel):
    nome: str = Field(min_length=1, max_length=60)
    tipo: str = Field(pattern="^(inversor|painel)$")
    ativo: bool = True


class BrandOut(BrandIn, ORM):
    id: str


# ── Itens (orçamento / OS) ──────────────────────────────────────
class ItemBase(BaseModel):
    product_id: Optional[str] = None
    description: str
    quantity: float = 1
    unit_price: float = 0
    component: Optional[str] = None
    qty_label: Optional[str] = None


class ItemIn(ItemBase):
    _desc = field_validator("description")(v.required)

    @model_validator(mode="after")
    def _valores(self):
        if not (self.quantity or 0) > 0:
            raise ValueError(f"Item “{self.description}”: a quantidade deve ser maior que zero.")
        # "Desconto"/"Ajuste de valor" são criados na aprovação do orçamento e podem ser negativos
        if (self.unit_price or 0) < 0 and self.description not in ("Desconto", "Ajuste de valor"):
            raise ValueError(f"Item “{self.description}”: o preço não pode ser negativo.")
        return self


class ItemOut(ItemBase, ORM):
    id: str


# ── Orçamentos ──────────────────────────────────────────────────
class QuoteIn(BaseModel):
    client_id: str
    seller_id: Optional[str] = None
    installation_id: Optional[str] = None
    service_type: str = "Instalação Solar"
    status: str = "Rascunho"
    sizing: Optional[dict] = None
    discount: float = Field(0, ge=0)
    valor_investimento: Optional[float] = Field(None, gt=0)  # vazio = soma dos itens − desconto
    payment_terms: Optional[str] = None
    validity_days: int = Field(15, ge=1, le=365)
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
    valor_investimento: Optional[float] = None
    total: float
    payment_terms: Optional[str] = None
    validity_days: int
    notes: Optional[str] = None
    local_instalacao: Optional[str] = None
    potencia_kwp: Optional[float] = None
    marca_inversor_id: Optional[str] = None
    potencia_inversor_kw: Optional[float] = None
    marca_painel_id: Optional[str] = None
    marca_inversor: Optional[BrandOut] = None
    marca_painel: Optional[BrandOut] = None
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
    installments: int = Field(1, ge=1, le=60)
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
    warranty_days: int = Field(90, ge=0)
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
    # A imagem da assinatura vem em /orders/{id}/signature (fica fora da lista para não pesar)
    has_signature: bool = False
    signed_by: Optional[str] = None
    signed_at: Optional[dt.datetime] = None


class PhotoIn(BaseModel):
    image: str = Field(max_length=4_000_000)   # ~3 MB de JPEG em base64
    thumb: str = Field(max_length=300_000)
    legenda: Optional[str] = Field(None, max_length=200)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    taken_at: Optional[dt.datetime] = None


class PhotoCaptionIn(BaseModel):
    legenda: Optional[str] = Field(None, max_length=200)


class PhotoOut(ORM):
    id: str
    legenda: Optional[str] = None
    thumb: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    taken_at: Optional[dt.datetime] = None
    created_at: Optional[dt.datetime] = None
    user: Optional[Ref] = None


class PhotoFull(PhotoOut):
    image: str


class SignatureIn(BaseModel):
    signature: str = Field(max_length=600_000)
    signed_by: str = Field(min_length=2, max_length=120)


class SignatureOut(BaseModel):
    signature: Optional[str] = None
    signed_by: Optional[str] = None
    signed_at: Optional[dt.datetime] = None


class StatusIn(BaseModel):
    status: str


# ── Manutenção ──────────────────────────────────────────────────
class PlanBase(BaseModel):
    client_id: str
    installation_id: Optional[str] = None
    title: str
    service_type: str = "Manutenção Preventiva"
    frequency_months: int = 6
    value: float = 0
    next_date: Optional[dt.date] = None
    active: bool = True
    notes: Optional[str] = None


class PlanIn(PlanBase):
    _title = field_validator("title")(v.required)
    frequency_months: int = Field(6, ge=1, le=60)
    value: float = Field(0, ge=0)


class PlanOut(PlanBase, ORM):
    id: str
    last_date: Optional[dt.date] = None
    client: Optional[Ref] = None
    installation: Optional[Ref] = None


# ── Agenda ──────────────────────────────────────────────────────
class AppointmentBase(BaseModel):
    title: str
    type: str = "Visita Técnica"
    client_id: Optional[str] = None
    technician_id: Optional[str] = None
    os_id: Optional[str] = None
    start: dt.datetime
    duration_min: int = 60
    status: str = "Agendado"
    notes: Optional[str] = None


class AppointmentIn(AppointmentBase):
    _title = field_validator("title")(v.required)
    duration_min: int = Field(60, gt=0, le=24 * 60)


class AppointmentOut(AppointmentBase, ORM):
    id: str
    client: Optional[Ref] = None
    technician: Optional[Ref] = None


# ── Financeiro ──────────────────────────────────────────────────
class FinanceBase(BaseModel):
    kind: str
    description: str
    category: str = "Serviços"
    amount: float
    due_date: dt.date
    paid: bool = False
    paid_date: Optional[dt.date] = None
    payment_method: Optional[str] = None
    client_id: Optional[str] = None


class FinanceIn(FinanceBase):
    _desc = field_validator("description")(v.required)
    kind: str = Field(pattern="^(receita|despesa)$")
    amount: float = Field(gt=0)


class FinanceOut(FinanceBase, ORM):
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
    potencia_inversor_kw: Optional[float] = Field(None, gt=0)  # vazio = sugerido pelo cálculo
    marca_inversor_id: Optional[str] = None
    marca_painel_id: Optional[str] = None


AnyDict = dict[str, Any]
