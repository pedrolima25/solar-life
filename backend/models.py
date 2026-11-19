import datetime
import uuid

from sqlalchemy import JSON, Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


def gen_id():
    return str(uuid.uuid4())


def now():
    return datetime.datetime.now()


class Company(Base):
    """Dados da empresa (usados no cabeçalho de impressões)."""
    __tablename__ = "company"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, default="Minha Empresa Solar")
    cnpj = Column(String)
    phone = Column(String)
    email = Column(String)
    address = Column(Text)
    responsavel_tecnico = Column(String)
    crea = Column(String)
    # Parâmetros padrão do dimensionamento
    tarifa_kwh = Column(Float, default=0.95)
    hsp_padrao = Column(Float, default=5.0)
    custo_kwp = Column(Float, default=3800.0)
    potencia_modulo_w = Column(Integer, default=550)
    # Proposta comercial
    slogan = Column(String)
    logo = Column(Text)                 # imagem em data URL (vazio = logo padrão)
    escopo_padrao = Column(Text)        # "O que está contemplado"
    observacoes_padrao = Column(Text)   # uma observação por linha
    hsp_mensal = Column(JSON)           # 12 valores de irradiação (h/dia), jan..dez
    custo_bateria_kwh = Column(Float, default=2800.0)  # preço de venda por kWh de bateria de lítio


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="tecnico")  # admin | vendedor | tecnico
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now)


class Client(Base):
    __tablename__ = "clients"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    person_type = Column(String, default="PF")  # PF | PJ
    document = Column(String)                   # CPF / CNPJ
    phone = Column(String)
    email = Column(String)
    cep = Column(String)
    address = Column(String)
    number = Column(String)
    neighborhood = Column(String)
    city = Column(String)
    state = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=now)

    installations = relationship("Installation", back_populates="client", cascade="all, delete-orphan")


class Installation(Base):
    """Sistema instalado no cliente: usina solar ou instalação elétrica."""
    __tablename__ = "installations"
    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, default="Solar On-Grid")
    status = Column(String, default="Ativa")  # Em Projeto | Em Instalação | Aguardando Homologação | Ativa | Inativa
    address = Column(Text)
    concessionaria = Column(String)
    unidade_consumidora = Column(String)
    tipo_ligacao = Column(String)  # Monofásico | Bifásico | Trifásico
    tensao = Column(String)
    # Solar
    potencia_kwp = Column(Float)
    num_modulos = Column(Integer)
    modulo_modelo = Column(String)
    inversor_modelo = Column(String)
    potencia_inversor_kw = Column(Float)
    geracao_estimada_kwh = Column(Float)
    estrutura = Column(String)
    # Off-Grid / Híbrido
    banco_baterias = Column(String)     # ex.: "4 × Lítio 48 V 5,12 kWh (20,5 kWh)"
    autonomia = Column(String)          # ex.: "1,5 dia" / "4 h de reserva"
    # Geral
    disjuntor_geral = Column(String)
    description = Column(Text)
    installation_date = Column(Date)
    warranty_until = Column(Date)
    created_at = Column(DateTime, default=now)

    client = relationship("Client", back_populates="installations")


class Product(Base):
    """Materiais e equipamentos (módulos, inversores, cabos, disjuntores...) e serviços."""
    __tablename__ = "products"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    category = Column(String, default="Material Elétrico")
    brand = Column(String)
    unit = Column(String, default="un")
    cost_price = Column(Float, default=0)
    sale_price = Column(Float, default=0)
    stock = Column(Float, default=0)
    min_stock = Column(Float, default=0)
    is_service = Column(Boolean, default=False)  # serviço/mão de obra não controla estoque
    created_at = Column(DateTime, default=now)


class Brand(Base):
    """Marcas de inversor e de painel usadas nos orçamentos (cadastráveis em Configurações)."""
    __tablename__ = "marcas"
    __table_args__ = (UniqueConstraint("nome", "tipo", name="uq_marca_nome_tipo"),)
    id = Column(String, primary_key=True, default=gen_id)
    nome = Column(String(60), nullable=False)
    tipo = Column(String(10), nullable=False)   # inversor | painel
    ativo = Column(Boolean, default=True, nullable=False)


class Quote(Base):
    """Orçamento / proposta comercial."""
    __tablename__ = "quotes"
    id = Column(String, primary_key=True, default=gen_id)
    number = Column(Integer, index=True)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    seller_id = Column(String, ForeignKey("users.id"))
    installation_id = Column(String, ForeignKey("installations.id"))
    service_type = Column(String, default="Instalação Solar")
    status = Column(String, default="Rascunho")  # Rascunho | Enviado | Aprovado | Recusado
    sizing = Column(JSON)  # resultado do dimensionamento solar
    subtotal = Column(Float, default=0)
    discount = Column(Float, default=0)
    valor_investimento = Column(Float)  # opcional: valor final digitado; substitui itens − desconto
    total = Column(Float, default=0)
    payment_terms = Column(String)
    validity_days = Column(Integer, default=15)
    notes = Column(Text)
    local_instalacao = Column(String)
    potencia_kwp = Column(Float)        # opcional: sobrescreve a potência calculada pelos itens
    # Equipamentos, gerador e baterias (preenchidos a partir do dimensionamento ao salvar)
    marca_inversor_id = Column(String, ForeignKey("marcas.id"))
    potencia_inversor_kw = Column(Float)
    marca_painel_id = Column(String, ForeignKey("marcas.id"))
    qtd_paineis = Column(Integer)
    potencia_painel_w = Column(Integer)
    kwp = Column(Float)                 # qtd_paineis x potencia_painel_w / 1000
    tipo_bateria = Column(String)       # chumbo | litio | sem  (vazio = On-Grid, sem banco)
    qtd_baterias = Column(Integer)      # 0 quando tipo_bateria = "sem"; > 0 nos outros casos
    # Link público para o cliente ver a apresentação (sem login)
    share_token = Column(String, index=True)
    share_views = Column(Integer, default=0)
    share_last_view = Column(DateTime)
    os_id = Column(String)
    created_at = Column(DateTime, default=now)
    approved_at = Column(DateTime)

    client = relationship("Client")
    marca_inversor = relationship("Brand", foreign_keys=[marca_inversor_id])
    marca_painel = relationship("Brand", foreign_keys=[marca_painel_id])
    items = relationship("QuoteItem", cascade="all, delete-orphan", order_by="QuoteItem.position")


class QuoteItem(Base):
    __tablename__ = "quote_items"
    id = Column(String, primary_key=True, default=gen_id)
    quote_id = Column(String, ForeignKey("quotes.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"))
    description = Column(String, nullable=False)
    quantity = Column(Float, default=1)
    unit_price = Column(Float, default=0)
    component = Column(String)   # rótulo na proposta (ex.: "Módulos fotovoltaicos")
    qty_label = Column(String)   # quantidade exibida (ex.: "30 + 30", "2 pares")
    position = Column(Integer, default=0)


class ServiceOrder(Base):
    __tablename__ = "service_orders"
    id = Column(String, primary_key=True, default=gen_id)
    number = Column(Integer, index=True)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    installation_id = Column(String, ForeignKey("installations.id"))
    technician_id = Column(String, ForeignKey("users.id"))
    quote_id = Column(String)
    plan_id = Column(String)
    service_type = Column(String, default="Manutenção Corretiva")
    priority = Column(String, default="Normal")  # Baixa | Normal | Alta | Urgente
    status = Column(String, default="Aberta")
    service_address = Column(Text)
    scheduled_date = Column(DateTime)
    problem = Column(Text)
    diagnosis = Column(Text)
    solution = Column(Text)
    checklist = Column(JSON)      # [{"item": str, "ok": bool}]
    measurements = Column(JSON)   # {"Tensão L1-N (V)": "220", ...}
    warranty_days = Column(Integer, default=90)
    art_number = Column(String)
    total = Column(Float, default=0)
    paid = Column(Boolean, default=False)
    stock_deducted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)
    finished_at = Column(DateTime)

    client = relationship("Client")
    installation = relationship("Installation")
    technician = relationship("User")
    items = relationship("ServiceOrderItem", cascade="all, delete-orphan", order_by="ServiceOrderItem.position")


class ServiceOrderItem(Base):
    __tablename__ = "service_order_items"
    id = Column(String, primary_key=True, default=gen_id)
    os_id = Column(String, ForeignKey("service_orders.id"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"))
    description = Column(String, nullable=False)
    quantity = Column(Float, default=1)
    unit_price = Column(Float, default=0)
    component = Column(String)   # rótulo na proposta (ex.: "Módulos fotovoltaicos")
    qty_label = Column(String)   # quantidade exibida (ex.: "30 + 30", "2 pares")
    position = Column(Integer, default=0)


class MaintenancePlan(Base):
    """Contrato de manutenção recorrente (limpeza de módulos, preventiva, inspeção)."""
    __tablename__ = "maintenance_plans"
    id = Column(String, primary_key=True, default=gen_id)
    client_id = Column(String, ForeignKey("clients.id"), nullable=False)
    installation_id = Column(String, ForeignKey("installations.id"))
    title = Column(String, nullable=False)
    service_type = Column(String, default="Manutenção Preventiva")
    frequency_months = Column(Integer, default=6)
    value = Column(Float, default=0)
    next_date = Column(Date)
    last_date = Column(Date)
    active = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=now)

    client = relationship("Client")
    installation = relationship("Installation")


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(String, primary_key=True, default=gen_id)
    title = Column(String, nullable=False)
    type = Column(String, default="Visita Técnica")
    client_id = Column(String, ForeignKey("clients.id"))
    technician_id = Column(String, ForeignKey("users.id"))
    os_id = Column(String)
    start = Column(DateTime, nullable=False)
    duration_min = Column(Integer, default=60)
    status = Column(String, default="Agendado")  # Agendado | Concluído | Cancelado
    notes = Column(Text)

    client = relationship("Client")
    technician = relationship("User")


class FinanceEntry(Base):
    __tablename__ = "finance_entries"
    id = Column(String, primary_key=True, default=gen_id)
    kind = Column(String, nullable=False)  # receita | despesa
    description = Column(String, nullable=False)
    category = Column(String, default="Serviços")
    amount = Column(Float, nullable=False)
    due_date = Column(Date, nullable=False)
    paid = Column(Boolean, default=False)
    paid_date = Column(Date)
    payment_method = Column(String)
    client_id = Column(String, ForeignKey("clients.id"))
    os_id = Column(String)
    quote_id = Column(String)
    created_at = Column(DateTime, default=now)

    client = relationship("Client")
