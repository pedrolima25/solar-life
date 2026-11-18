"use client";

import { BatteryCharging, Cpu, Gauge, Leaf, PiggyBank, SolarPanel, TrendingUp, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Field } from "@/components/ui";
import { api } from "@/lib/api";
import { LIGACOES, SISTEMAS_SOLARES, TIPOS_BATERIA } from "@/lib/constants";
import { brl, num } from "@/lib/format";
import type { Item, Product } from "./ItemsEditor";

export type SizingInput = {
  consumo_kwh: number | null;
  tipo_ligacao: string;
  hsp: number | null;
  potencia_modulo_w: number | null;
  tarifa_kwh: number | null;
  custo_kwp: number | null;
  tipo_sistema: string;
  tipo_bateria: string;
  autonomia_dias: number | null;
  carga_essencial_kw: number | null;
  horas_backup: number | null;
};

export const EMPTY_SIZING: SizingInput = {
  consumo_kwh: null, tipo_ligacao: "Bifásico", hsp: null, potencia_modulo_w: null, tarifa_kwh: null, custo_kwp: null,
  tipo_sistema: "On-Grid", tipo_bateria: "Lítio", autonomia_dias: 1, carga_essencial_kw: 1.5, horas_backup: 4,
};

/** Reconstrói o formulário a partir de um dimensionamento salvo. */
export function sizingInputFrom(r: any): SizingInput {
  if (!r) return EMPTY_SIZING;
  const out: any = { ...EMPTY_SIZING };
  for (const k of Object.keys(EMPTY_SIZING)) if (r[k] !== undefined && r[k] !== null) out[k] = r[k];
  return out;
}

/** Formulário de dimensionamento com cálculo automático no backend. */
export function SizingForm({ input, onInput, onResult, narrow }: {
  narrow?: boolean;
  input: SizingInput;
  onInput: (v: SizingInput) => void;
  onResult: (r: any | null) => void;
}) {
  const [company, setCompany] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/company").then(setCompany).catch(() => null);
  }, []);

  useEffect(() => {
    if (!input.consumo_kwh || input.consumo_kwh <= 0) {
      onResult(null);
      return;
    }
    const t = setTimeout(() => {
      const body = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== null && v !== ""));
      api("/solar/sizing", { method: "POST", json: body })
        .then((r) => { setError(""); onResult(r); })
        .catch((e) => setError(e.message));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(input)]);

  const set = (k: keyof SizingInput, numeric = true) => ({
    value: (input[k] ?? "") as any,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onInput({ ...input, [k]: numeric ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value }),
  });

  const sistema = input.tipo_sistema || "On-Grid";

  return (
    <div className={`grid gap-4 ${narrow ? "grid-cols-2" : "sm:grid-cols-3"}`}>
      <div className="col-span-full">
        <span className="label">Tipo de sistema</span>
        <div className="grid grid-cols-3 gap-2">
          {SISTEMAS_SOLARES.map((t) => (
            <button key={t.id} type="button" onClick={() => onInput({ ...input, tipo_sistema: t.id })}
              className={`rounded-xl border px-2 py-2 text-left transition ${sistema === t.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted"}`}>
              <p className={`text-sm font-semibold ${sistema === t.id ? "text-primary" : ""}`}>{t.id}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>
      <Field label="Consumo médio (kWh/mês)"><input className="input" type="number" min={0} placeholder="Ex.: 450" {...set("consumo_kwh")} /></Field>
      {sistema !== "Off-Grid" && (
        <Field label="Tipo de ligação">
          <select className="input" {...set("tipo_ligacao", false)}>{LIGACOES.map((l) => <option key={l}>{l}</option>)}</select>
        </Field>
      )}
      <Field label="Irradiação — HSP (h/dia)"><input className="input" type="number" step="0.1" placeholder={company ? String(company.hsp_padrao) : ""} {...set("hsp")} /></Field>
      <Field label="Potência do módulo (W)"><input className="input" type="number" placeholder={company ? String(company.potencia_modulo_w) : ""} {...set("potencia_modulo_w")} /></Field>
      <Field label="Tarifa (R$/kWh)"><input className="input" type="number" step="0.01" placeholder={company ? String(company.tarifa_kwh) : ""} {...set("tarifa_kwh")} /></Field>
      <Field label="Preço por kWp (R$)"><input className="input" type="number" placeholder={company ? String(company.custo_kwp) : ""} {...set("custo_kwp")} /></Field>
      {sistema !== "On-Grid" && (
        <>
          <Field label="Tipo de bateria">
            <select className="input" {...set("tipo_bateria", false)}>{TIPOS_BATERIA.map((b) => <option key={b}>{b}</option>)}</select>
          </Field>
          {sistema === "Off-Grid" ? (
            <Field label="Autonomia (dias sem sol)"><input className="input" type="number" step="0.5" min={0.5} {...set("autonomia_dias")} /></Field>
          ) : (
            <>
              <Field label="Cargas essenciais (kW)"><input className="input" type="number" step="0.1" min={0} {...set("carga_essencial_kw")} /></Field>
              <Field label="Reserva sem luz (horas)"><input className="input" type="number" step="0.5" min={0} {...set("horas_backup")} /></Field>
            </>
          )}
        </>
      )}
      {error && <p className="col-span-full text-sm text-red-500">{error}</p>}
      <p className="col-span-full text-xs text-muted-foreground">
        Campos em branco usam os valores padrão definidos em Configurações.
        {sistema === "Off-Grid" && " No Off-Grid, o HSP em branco usa o pior mês do ano, pois não há rede para complementar."}
        {sistema === "Híbrido" && " Cargas essenciais: o que precisa funcionar quando faltar luz (geladeira, iluminação, internet, bomba…)."}
      </p>
    </div>
  );
}

export function SizingResult({ r, compact }: { r: any; compact?: boolean }) {
  const cards = [
    { icon: SolarPanel, label: "Potência do sistema", value: `${num(r.kwp_real, 2)} kWp`, hint: `${r.num_modulos} módulos de ${r.potencia_modulo_w} W` },
    { icon: Zap, label: "Geração estimada", value: `${num(r.geracao_mensal_kwh)} kWh/mês`, hint: `${num(r.geracao_anual_kwh)} kWh/ano` },
    { icon: Gauge, label: "Inversor sugerido", value: `${num(r.inversor_kw, 1)} kW`, hint: `Área aprox.: ${num(r.area_m2, 1)} m²` },
    { icon: PiggyBank, label: "Economia mensal", value: brl(r.economia_mensal), hint: `Conta: ${brl(r.conta_atual)} → ${brl(r.conta_nova)}` },
    { icon: TrendingUp, label: "Retorno (payback)", value: r.payback_anos ? `${num(r.payback_anos, 1)} anos` : "—", hint: `Investimento: ${brl(r.investimento)}` },
    { icon: Leaf, label: "Economia em 25 anos", value: brl(r.economia_25_anos), hint: `${num(r.co2_evitado_ton_ano, 2)} t de CO₂ evitadas/ano` },
  ];
  const sistema = r.tipo_sistema || "On-Grid";
  if (sistema !== "On-Grid") {
    cards.splice(3, 0, {
      icon: BatteryCharging, label: "Banco de baterias", value: `${num(r.banco_kwh, 1)} kWh`,
      hint: `${r.num_baterias} × ${r.tipo_bateria} ${r.bateria_unidade} · ${num(r.banco_util_kwh, 1)} kWh úteis`,
    });
    cards.splice(4, 0, sistema === "Off-Grid"
      ? { icon: Cpu, label: "Autonomia", value: `${num(r.autonomia_dias, 1)} dia(s)`, hint: `Controlador MPPT ≥ ${r.controlador_a} A em ${r.tensao_banco} V` }
      : { icon: Cpu, label: "Reserva sem luz", value: `${num(r.horas_backup, 1)} h`, hint: `Para ${num(r.carga_essencial_kw, 1)} kW de cargas essenciais` });
    if (sistema === "Off-Grid") {
      cards[cards.findIndex((c) => c.label === "Economia mensal")] = {
        icon: PiggyBank, label: "Valor da energia gerada", value: brl(r.economia_mensal), hint: "Sem conta de luz: custo evitado à tarifa de referência",
      };
    }
    const pb = cards.findIndex((c) => c.label === "Retorno (payback)");
    cards[pb] = { ...cards[pb], hint: `Investimento: ${brl(r.investimento)} (baterias ${brl(r.custo_baterias)})` };
    if (sistema === "Off-Grid") cards[pb] = { ...cards[pb], value: "Não se aplica", hint: `Sistema isolado · investimento ${brl(r.investimento)} (baterias ${brl(r.custo_baterias)})` };
    else if (!r.payback_anos) cards[pb].value = "Acima de 25 anos";
  }

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <c.icon className="h-4 w-4 text-primary" /> {c.label}
            </div>
            <p className="mt-1 text-lg font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>
      {!compact && (
        <PaybackChart r={r} />
      )}
    </div>
  );
}

/** Saldo acumulado ano a ano: vermelho = ainda pagando o sistema, verde = já se pagou (lucro). */
export function PaybackChart({ r }: { r: any }) {
  const fluxo: any[] = r.fluxo;
  const maxPos = Math.max(0, ...fluxo.map((f) => f.acumulado));
  const maxNeg = Math.max(0, ...fluxo.map((f) => -f.acumulado), r.investimento || 0);
  const total = maxPos + maxNeg || 1;
  const zero = (maxPos / total) * 100; // posição da linha do zero (% a partir do topo)
  // Ano em que o saldo vira positivo e não volta a ficar negativo
  let pagoNoAno: number | null = null;
  for (let i = fluxo.length - 1; i >= 0 && fluxo[i].acumulado >= 0; i--) pagoNoAno = fluxo[i].ano;
  const final = fluxo[fluxo.length - 1]?.acumulado ?? 0;
  const trocas = fluxo.filter((f) => f.troca_baterias > 0).map((f) => f.ano);

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Retorno do investimento em 25 anos</p>
          <p className="text-xs text-muted-foreground">Saldo do cliente: economia acumulada menos o valor pago no sistema.</p>
        </div>
        <div className="text-right text-sm">
          {pagoNoAno
            ? <p className="font-semibold text-emerald-500">Se paga no ano {pagoNoAno}</p>
            : <p className="font-semibold text-red-500">Não se paga em 25 anos</p>}
          <p className="text-xs text-muted-foreground">Saldo no ano 25: <b className={final >= 0 ? "text-emerald-500" : "text-red-500"}>{brl(final)}</b></p>
        </div>
      </div>

      <div className="relative h-44">
        <div className="absolute inset-x-0 border-t border-dashed border-muted-foreground/50" style={{ top: `${zero}%` }}>
          <span className="absolute -top-2 right-0 bg-background pl-1 text-[10px] text-muted-foreground">R$ 0</span>
        </div>
        <div className="flex h-full gap-[3px] pr-8">
          {fluxo.map((f) => {
            const pos = f.acumulado >= 0;
            const h = (Math.abs(f.acumulado) / total) * 100;
            return (
              <div key={f.ano} className="group relative h-full flex-1" title={`Ano ${f.ano}: saldo ${brl(f.acumulado)}${f.troca_baterias ? ` · troca de baterias ${brl(f.troca_baterias)}` : ""}`}>
                <div className={`absolute inset-x-0 ${pos ? "rounded-t bg-emerald-500" : "rounded-b bg-red-500/80"} group-hover:opacity-80`}
                  style={pos ? { bottom: `${100 - zero}%`, height: `${h}%` } : { top: `${zero}%`, height: `${h}%` }} />
                {f.troca_baterias > 0 && (
                  <span className="absolute inset-x-0 text-center text-[11px]" style={{ top: `${Math.min(zero + h, 92)}%` }}>🔋</span>
                )}
                {f.ano === pagoNoAno && (
                  <span className="absolute inset-x-0 text-center text-[11px]" style={{ bottom: `${100 - zero + h}%` }}>✓</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-[3px] pr-8 text-[10px] text-muted-foreground">
        {fluxo.map((f) => <span key={f.ano} className="flex-1 text-center">{f.ano === 1 || f.ano % 5 === 0 ? f.ano : ""}</span>)}
      </div>
      <p className="text-center text-[10px] text-muted-foreground">ano</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500/80" /> Ainda pagando o sistema</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Já se pagou (lucro)</span>
        {trocas.length > 0 && <span>🔋 Troca das baterias ({brl(r.custo_baterias)}) no ano {trocas.join(" e ")}</span>}
      </div>
    </div>
  );
}

/** Sugere itens do orçamento a partir do dimensionamento e do catálogo. */
export function suggestItems(r: any, products: Product[]): Item[] {
  const find = (cat: string, test?: (p: Product) => boolean) => products.find((p) => p.category === cat && (!test || test(p)));
  const items: Item[] = [];
  // Prefere o módulo do catálogo com a mesma potência do dimensionamento; se for outro,
  // recalcula a quantidade pela potência dele para não ficar abaixo do necessário.
  const watts = (p: Product) => Number(p.name.match(/(\d+(?:[.,]\d+)?)\s*W\b/i)?.[1].replace(",", ".") || 0);
  const modulos = products.filter((p) => p.category === "Módulo Solar");
  const modulo = modulos.find((p) => watts(p) === r.potencia_modulo_w) ?? modulos[0];
  const wMod = (modulo && watts(modulo)) || r.potencia_modulo_w;
  const qtdModulos = wMod === r.potencia_modulo_w ? r.num_modulos : Math.max(Math.ceil((r.kwp_necessario * 1000) / wMod), 1);
  const kwpItens = Math.round(qtdModulos * wMod) / 1000;
  items.push({ product_id: modulo?.id ?? null, description: modulo?.name ?? `Módulo fotovoltaico ${r.potencia_modulo_w} W`, quantity: qtdModulos, unit_price: modulo?.sale_price ?? 0 });

  const sistema = r.tipo_sistema || "On-Grid";
  const ehDoTipo = (p: Product) =>
    sistema === "Off-Grid" ? /off.?grid/i.test(p.name) : sistema === "Híbrido" ? /h[íi]brido/i.test(p.name) : !/off.?grid|h[íi]brido/i.test(p.name);
  const todosInv = products.filter((p) => p.category === "Inversor");
  const inversores = todosInv.some(ehDoTipo) ? todosInv.filter(ehDoTipo) : todosInv;
  const kw = (p: Product) => Number((p.name.match(/(\d+[.,]?\d*)\s*kW/i)?.[1] || "0").replace(",", "."));
  const inversor = inversores.filter((p) => kw(p) >= r.inversor_kw).sort((a, b) => kw(a) - kw(b))[0] ?? inversores.sort((a, b) => kw(b) - kw(a))[0];
  items.push({ product_id: inversor?.id ?? null, description: inversor?.name ?? `Inversor ${sistema.toLowerCase()} ${r.inversor_kw} kW`, quantity: 1, unit_price: inversor?.sale_price ?? 0 });

  const estrutura = find("Estrutura", (p) => !/bateria/i.test(p.name));
  if (estrutura) items.push({ product_id: estrutura.id, description: estrutura.name, quantity: Math.ceil(qtdModulos / 4), unit_price: estrutura.sale_price });
  const cabo = find("Cabos", (p) => /solar/i.test(p.name));
  if (cabo) items.push({ product_id: cabo.id, description: cabo.name, quantity: Math.max(30, qtdModulos * 4), unit_price: cabo.sale_price });
  const mc4 = find("Conectores");
  if (mc4) items.push({ product_id: mc4.id, description: mc4.name, quantity: Math.max(4, Math.ceil(qtdModulos / 4) * 2), unit_price: mc4.sale_price });
  const sb = find("Proteção", (p) => /string/i.test(p.name));
  if (sb) items.push({ product_id: sb.id, description: sb.name, quantity: 1, unit_price: sb.sale_price });
  if (sistema !== "On-Grid" && r.num_baterias) {
    const litio = r.tipo_bateria === "Lítio";
    const bat = find("Bateria", (p) => (litio ? /l[íi]tio|lifepo/i : /estacion|chumbo|12 ?v/i).test(p.name));
    items.push({ product_id: bat?.id ?? null, description: bat?.name ?? `Bateria ${r.tipo_bateria} ${r.bateria_unidade}`, quantity: r.num_baterias, unit_price: bat?.sale_price ?? 0 });
    if (sistema === "Off-Grid") {
      const ctrl = find("Controlador de Carga");
      items.push({ product_id: ctrl?.id ?? null, description: ctrl?.name ?? `Controlador de carga MPPT ${r.controlador_a} A`, quantity: Math.max(1, Math.ceil(r.controlador_a / 60)), unit_price: ctrl?.sale_price ?? 0 });
    }
    const protBat = find("Proteção", (p) => /bateria/i.test(p.name));
    if (protBat) items.push({ product_id: protBat.id, description: protBat.name, quantity: 1, unit_price: protBat.sale_price });
    const caboBat = find("Cabos", (p) => /bateria/i.test(p.name));
    if (caboBat) items.push({ product_id: caboBat.id, description: caboBat.name, quantity: 4, unit_price: caboBat.sale_price });
    const rack = find("Estrutura", (p) => /bateria/i.test(p.name));
    if (rack) items.push({ product_id: rack.id, description: rack.name, quantity: 1, unit_price: rack.sale_price });
    const moBat = find("Mão de Obra", (p) => /bateria/i.test(p.name));
    if (moBat) items.push({ product_id: moBat.id, description: moBat.name, quantity: 1, unit_price: moBat.sale_price });
  }
  const mo = find("Mão de Obra", (p) => /solar/i.test(p.name));
  if (mo) items.push({ product_id: mo.id, description: mo.name, quantity: kwpItens, unit_price: mo.sale_price });
  const projeto = find("Projeto", (p) => /homolog/i.test(p.name));
  if (projeto && sistema !== "Off-Grid") items.push({ product_id: projeto.id, description: projeto.name, quantity: 1, unit_price: projeto.sale_price });
  return items;
}
