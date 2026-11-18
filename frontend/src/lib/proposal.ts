/** Cálculos da proposta comercial (potência, geração mensal, payback simples). */

export const DEFAULT_LOGO = "/logo-solar-life.png";
export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const EFICIENCIA = 0.8;

export const UF_NOMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

/** Rótulo da coluna "Componente" a partir da categoria do produto. */
export const COMPONENTE_POR_CATEGORIA: Record<string, string> = {
  "Módulo Solar": "Módulos fotovoltaicos",
  Inversor: "Inversor",
  Bateria: "Banco de baterias",
  "Controlador de Carga": "Controlador de carga",
  Estrutura: "Estrutura de fixação",
  Cabos: "Cabos",
  Conectores: "Conectores",
  Proteção: "Proteção",
  "Mão de Obra": "Mão de obra",
  Projeto: "Projeto",
};

const isModulo = (t: string) => /m[óo]dulo|placa|painel/i.test(t);
const isInversor = (t: string) => /inversor/i.test(t);

function parseNum(s: string) {
  return Number(s.replace(",", "."));
}

/** Potência em kWp somando os módulos dos itens (ex.: 12 × "RONMA 620 W"). */
export function kwpFromItems(items: any[]): number {
  let w = 0;
  for (const it of items) {
    const text = `${it.component ?? ""} ${it.description ?? ""}`;
    if (!isModulo(text)) continue;
    const m = (it.description ?? "").match(/(\d+(?:[.,]\d+)?)\s*W[p]?\b/i);
    if (m) w += parseNum(m[1]) * (Number(it.quantity) || 0);
  }
  return Math.round(w) / 1000;
}

/** Potência do inversor (kW CA) e fase, lidas da descrição dos itens. */
export function inverterFromItems(items: any[]): { kw: number; fase: string } | null {
  let kw = 0;
  let fase = "";
  for (const it of items) {
    const text = `${it.component ?? ""} ${it.description ?? ""}`;
    if (!isInversor(text)) continue;
    const m = (it.description ?? "").match(/(\d+(?:[.,]\d+)?)\s*kW\b/i);
    if (m) kw += parseNum(m[1]) * (Number(it.quantity) || 1);
    const f = text.match(/(monof[áa]sico|bif[áa]sico|trif[áa]sico)/i);
    if (f && !fase) fase = f[1].toLowerCase();
  }
  return kw ? { kw, fase } : null;
}

/** Geração estimada por mês (kWh) = kWp × HSP do mês × 30 dias × eficiência. */
export function monthlyGeneration(kwp: number, hspMensal: number[] | null | undefined, hspPadrao: number) {
  const hsp = hspMensal?.length === 12 ? hspMensal : Array(12).fill(hspPadrao || 5);
  return hsp.map((h) => kwp * h * 30 * EFICIENCIA);
}

export function localLabel(client: any, sep = ", ") {
  if (!client) return "";
  const uf = (client.state ?? "").toUpperCase();
  const estado = sep === "/" ? uf : UF_NOMES[uf] ?? client.state;
  return [client.city, estado].filter(Boolean).join(sep);
}

/** Texto padrão: entrada de X% + N parcelas do saldo. */
export function defaultPaymentTerms(total: number, entradaPct = 70, parcelas = 2) {
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const entrada = Math.round(total * entradaPct) / 100;
  const saldo = total - entrada;
  const lines = [`Entrada de ${entradaPct}%: ${brl(entrada)}`];
  const momentos = ["no início do serviço", "na entrega/conclusão da instalação"];
  for (let i = 0; i < parcelas; i++) {
    const valor = i === parcelas - 1 ? saldo - Math.round((saldo / parcelas) * 100) / 100 * (parcelas - 1) : Math.round((saldo / parcelas) * 100) / 100;
    const quando = parcelas === 2 ? ` ${momentos[i]}` : "";
    lines.push(`${i + 1}ª parcela do saldo: ${brl(valor)}${quando}`);
  }
  return lines.join("\n");
}

/**
 * Números de economia de um orçamento, usando o valor real do orçamento como investimento.
 * Com dimensionamento salvo usa o fluxo dele; sem dimensionamento estima pela geração × tarifa.
 */
export function quoteEconomics(q: any, company: any) {
  const sz = q.sizing ?? null;
  const kwp = q.potencia_kwp || kwpFromItems(q.items) || sz?.kwp_real || 0;
  const tarifa = sz?.tarifa_kwh ?? company.tarifa_kwh;
  const meses = monthlyGeneration(kwp, company.hsp_mensal, sz?.hsp ?? company.hsp_padrao);
  const geracaoMes = meses.reduce((a, b) => a + b, 0) / 12;
  const investimento = q.total;

  let economiaMes: number;
  let contaAtual: number | null = null;
  let contaNova: number | null = null;
  let economiasAno: { ano: number; economia: number; troca: number }[];
  if (sz?.fluxo?.length) {
    economiaMes = sz.economia_mensal;
    contaAtual = sz.conta_atual;
    contaNova = sz.conta_nova;
    const vida = sz.vida_bateria_anos || 0;
    economiasAno = sz.fluxo.map((f: any) => {
      // Orçamentos antigos podiam ter troca de bateria nos últimos anos; não compensa trocar perto do fim
      const restante = sz.fluxo.length - f.ano + 1;
      const troca = vida && restante < vida / 2 ? 0 : f.troca_baterias || 0;
      return { ano: f.ano, economia: f.economia + (f.troca_baterias || 0), troca };
    });
  } else {
    economiaMes = geracaoMes * tarifa;
    economiasAno = Array.from({ length: 25 }, (_, i) => ({
      ano: i + 1, economia: economiaMes * 12 * 0.995 ** i * 1.06 ** i, troca: 0,
    }));
  }

  let acc = -investimento;
  const fluxo = economiasAno.map(({ ano, economia, troca }) => {
    const liquido = economia - troca;
    acc += liquido;
    return { ano, economia: liquido, acumulado: acc, troca_baterias: troca };
  });
  // Payback = momento a partir do qual o saldo fica positivo e não volta a ficar negativo
  let payback: number | null = null;
  const ultimoNegativo = fluxo.map((f) => f.acumulado < 0).lastIndexOf(true);
  if (ultimoNegativo === -1) payback = fluxo[0] ? (investimento / fluxo[0].economia) : null;
  else if (ultimoNegativo < fluxo.length - 1) {
    const prox = fluxo[ultimoNegativo + 1];
    payback = fluxo[ultimoNegativo].ano + -fluxo[ultimoNegativo].acumulado / prox.economia;
  }
  const economia25 = fluxo.reduce((s, f) => s + f.economia, 0);
  // Rendimento do 1º ano sobre o valor investido (para comparar com a poupança)
  const rendimentoAno = investimento > 0 ? (economiaMes * 12) / investimento : 0;

  return {
    sistema: (sz?.tipo_sistema as string) || "On-Grid",
    kwp, tarifa, geracaoMes, economiaMes, contaAtual, contaNova, investimento,
    payback: payback as number | null, fluxo, economia25, rendimentoAno, sz,
  };
}
