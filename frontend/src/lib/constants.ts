export const SERVICE_TYPES = [
  "Instalação Solar",
  "Manutenção Preventiva",
  "Manutenção Corretiva",
  "Limpeza de Módulos",
  "Instalação Elétrica",
  "Quadro de Distribuição",
  "Padrão de Entrada",
  "Laudo / Inspeção",
  "Manutenção de Baterias",
  "Visita Técnica",
];

/** Tipos de sistema fotovoltaico. */
export const SISTEMAS_SOLARES = [
  { id: "On-Grid", desc: "Ligado à rede, sem bateria" },
  { id: "Off-Grid", desc: "Isolado, com baterias" },
  { id: "Híbrido", desc: "Rede + bateria de reserva" },
];

export const TIPOS_BATERIA = ["Lítio", "Chumbo-ácido"];

export const OS_STATUS = [
  { id: "Aberta", color: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  { id: "Agendada", color: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  { id: "Em Execução", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { id: "Aguardando Material", color: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  { id: "Concluída", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { id: "Cancelada", color: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30" },
];

export const QUOTE_STATUS = [
  { id: "Rascunho", color: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30" },
  { id: "Enviado", color: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  { id: "Aprovado", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { id: "Recusado", color: "bg-red-500/15 text-red-500 border-red-500/30" },
];

export const PRIORITIES = ["Baixa", "Normal", "Alta", "Urgente"];

export const INSTALLATION_TYPES = [
  "Solar On-Grid",
  "Solar Off-Grid",
  "Solar Híbrido",
  "Elétrica Residencial",
  "Elétrica Comercial",
  "Elétrica Industrial",
];

export const INSTALLATION_STATUS = ["Em Projeto", "Em Instalação", "Aguardando Homologação", "Ativa", "Inativa"];

export const LIGACOES = ["Monofásico", "Bifásico", "Trifásico"];

export const PRODUCT_CATEGORIES = [
  "Módulo Solar", "Inversor", "Bateria", "Controlador de Carga", "Estrutura", "Cabos", "Conectores", "Proteção",
  "Material Elétrico", "Iluminação", "Mão de Obra", "Serviço", "Projeto", "Visita Técnica",
];

export const APPOINTMENT_TYPES = ["Visita Técnica", "Instalação", "Manutenção", "Vistoria", "Reunião Comercial"];

export const FINANCE_CATEGORIES = {
  receita: ["Serviços", "Instalação Solar", "Manutenção", "Venda de Material", "Outros"],
  despesa: ["Material", "Equipamentos", "Combustível", "Salários", "Aluguel", "Impostos", "Ferramentas", "Outros"],
};

export const PAYMENT_METHODS = ["PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Boleto", "Transferência", "Financiamento"];

export const ROLES: Record<string, string> = { admin: "Administrador", vendedor: "Vendedor", tecnico: "Técnico" };

/** Checklists sugeridos por tipo de serviço (podem ser editados na OS). */
export const CHECKLISTS: Record<string, string[]> = {
  "Instalação Solar": [
    "Inspeção do telhado/estrutura de fixação",
    "Fixação dos trilhos e módulos",
    "Polaridade e tensão de circuito aberto (Voc) das strings",
    "Conectores MC4 crimpados e travados",
    "String box / proteções CC instaladas",
    "Aterramento de módulos, estrutura e inversor",
    "DPS e disjuntor CA dimensionados",
    "Inversor configurado e monitoramento online",
    "Placa de advertência instalada",
    "Off-Grid/Híbrido: banco de baterias, fusíveis CC e configuração de carga",
    "Cliente orientado sobre o uso do app",
  ],
  "Manutenção Preventiva": [
    "Inspeção visual dos módulos (trincas, hot spots)",
    "Reaperto de conexões CA/CC",
    "Medição de Voc e corrente das strings",
    "Teste de isolamento",
    "Verificação do aterramento",
    "Verificação de DPS e disjuntores",
    "Leitura de alarmes/histórico do inversor",
    "Comparativo de geração x estimativa",
  ],
  "Limpeza de Módulos": [
    "Módulos limpos com água e escova macia",
    "Sem uso de produtos abrasivos",
    "Inspeção visual após limpeza",
    "Registro fotográfico antes/depois",
  ],
  "Manutenção Corretiva": [
    "Defeito identificado e registrado",
    "Circuito desenergizado e bloqueado (NR-10)",
    "Componente defeituoso substituído",
    "Teste de funcionamento após reparo",
  ],
  "Instalação Elétrica": [
    "Circuitos dimensionados conforme NBR 5410",
    "Bitola dos condutores conferida",
    "Disjuntores identificados no quadro",
    "IDR / DR instalado nas áreas molhadas",
    "Aterramento e equipotencialização",
    "Teste de tomadas e polaridade",
  ],
  "Quadro de Distribuição": [
    "Barramentos e reaperto",
    "Identificação dos circuitos",
    "DPS e DR instalados",
    "Medição de tensão entre fases e neutro",
    "Termografia / pontos quentes",
  ],
  "Manutenção de Baterias": [
    "Inspeção visual (estufamento, vazamento, corrosão nos bornes)",
    "Reaperto e limpeza dos bornes e barramentos",
    "Tensão de cada bateria e do banco medida",
    "Estado de carga (SOC) e saúde (SOH) no BMS/inversor",
    "Temperatura e ventilação do local das baterias",
    "Configuração de carga/descarga no inversor ou controlador",
    "Fusíveis e disjuntor CC do banco verificados",
    "Teste de funcionamento sem a rede (híbrido/off-grid)",
  ],
  "Padrão de Entrada": [
    "Padrão conforme norma da concessionária",
    "Disjuntor geral dimensionado",
    "Haste de aterramento",
    "Caixa de medição instalada",
  ],
};

export const MEASUREMENT_FIELDS = [
  "Tensão L1-N (V)", "Tensão L2-N (V)", "Tensão L1-L2 (V)", "Corrente (A)",
  "Voc string 1 (V)", "Voc string 2 (V)", "Tensão do banco de baterias (V)", "Estado de carga — SOC (%)", "Isolamento (MΩ)", "Resistência de aterramento (Ω)",
];
