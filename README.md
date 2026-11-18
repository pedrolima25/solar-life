# Solar Life — Gestão de Energia Solar e Serviços Elétricos

Sistema para empresas de **energia solar**, **manutenção elétrica** e **serviços elétricos em geral**.

## Módulos

| Módulo | O que faz |
|---|---|
| Painel | OS em aberto, orçamentos, recebimentos do mês, agenda, manutenções a vencer, estoque baixo |
| Simulador Solar | Dimensiona sistema on-grid pelo consumo (kWp, nº de módulos, inversor, geração, economia, payback, 25 anos) |
| Orçamentos | Proposta com dimensionamento, itens sugeridos automaticamente, impressão/PDF, envio por WhatsApp, aprovação (gera OS + contas a receber parceladas) |
| Ordens de Serviço | Quadro kanban (arrastar e soltar), técnico, agendamento, checklist por tipo de serviço, medições elétricas, ART, garantia, impressão; ao concluir dá baixa no estoque |
| Planos de Manutenção | Contratos recorrentes (limpeza de módulos, preventiva); botão "Gerar OS" agenda a visita e avança a próxima data |
| Agenda | Semana da equipe técnica, filtro por técnico |
| Clientes | Cadastro PF/PJ, busca de CEP, histórico de instalações, OS e orçamentos |
| Instalações / Usinas | Dados da usina (kWp, módulos, inversor, UC, concessionária) ou da instalação elétrica |
| Materiais / Estoque | Módulos, inversores, cabos, proteção, mão de obra e serviços; entradas e saídas |
| Financeiro | Receitas e despesas por mês, baixa de pagamentos, atrasados |
| Equipe | Usuários: administrador, vendedor, técnico |
| Configurações | Dados da empresa e padrões do dimensionamento (tarifa, HSP, R$/kWp, módulo) |

## Tecnologia

- **Frontend:** Next.js 16 + React 19 + Tailwind CSS 4 + lucide-react
- **Backend:** FastAPI + SQLAlchemy + SQLite (ou PostgreSQL via `DATABASE_URL`) + JWT

## Como rodar

```powershell
# 1. Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# 2. Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

Ou simplesmente execute `iniciar.ps1`.

Acesse http://localhost:3000 — login inicial: **admin@solar.com / admin123** (troque a senha em *Equipe*).

A documentação da API fica em http://localhost:8000/docs.

## Produção

- Copie `backend/.env.example` para `backend/.env` e defina `SECRET_KEY`, `ADMIN_PASSWORD` e, se quiser, `DATABASE_URL` (PostgreSQL).
- No frontend, defina `NEXT_PUBLIC_API_URL` com o endereço público da API.
