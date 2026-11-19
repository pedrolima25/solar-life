"use client";

import { Printer } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { Loading } from "@/components/ui";
import { brl, num } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import {
  COMPONENTE_POR_CATEGORIA, DEFAULT_LOGO, EFICIENCIA, MESES, inverterFromItems, kwpFromItems, localLabel, monthlyGeneration,
} from "@/lib/proposal";

const NAVY = "#0b3a74";

function qtyText(it: any, product: any) {
  if (it.qty_label) return it.qty_label;
  const q = Number(it.quantity) || 0;
  const unit = product?.unit ?? "un";
  const qs = q.toLocaleString("pt-BR");
  if (unit === "par") return `${qs} ${q > 1 ? "pares" : "par"}`;
  if (["un", "kit", ""].includes(unit)) return qs;
  return `${qs} ${unit}`;
}

function Sheet({ company, page, children }: { company: any; page: number; children: React.ReactNode }) {
  return (
    <div className="sheet mx-auto flex min-h-[297mm] w-[210mm] flex-col bg-white px-[16mm] pb-[8mm] pt-[10mm] text-[12px] text-zinc-800 shadow-lg print:shadow-none">
      <div className="flex-1">{children}</div>
      <footer className="mt-3 flex justify-between border-t border-[#c9d7e8] pt-2 text-[10px] text-zinc-500">
        <span>{[company.name, company.phone && `WhatsApp: ${company.phone}`, company.email].filter(Boolean).join("  |  ")}</span>
        <span>Página {page}</span>
      </footer>
    </div>
  );
}

function H2({ n, children }: { n: number; children: React.ReactNode }) {
  return <h3 className="mb-1.5 mt-4 text-[15px] font-bold" style={{ color: NAVY }}>{n}. {children}</h3>;
}

const th = "px-3 py-2.5 text-left text-[11px] font-bold uppercase text-white";
const cellBorder = "border-b border-[#d5e1ee]";

export default function PrintQuote() {
  const { id } = useParams<{ id: string }>();
  const { data: q } = useApi<any>(`/quotes/${id}`);
  const { data: company } = useApi<any>("/company");
  const { data: products } = useApi<any[]>("/products");
  const { data: client } = useApi<any>(q ? `/clients/${q.client_id}` : null);

  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (wasDark) html.classList.add("dark"); };
  }, []);

  if (!q || !company || !client || !products) return <Loading />;
  const c = client.client;
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));
  const items = q.items.filter((it: any) => it.description !== "Desconto");

  const kwp = q.potencia_kwp || kwpFromItems(q.items) || q.sizing?.kwp_real || 0;
  const solar = kwp > 0;
  const inv = inverterFromItems(q.items);
  const fase = inv?.fase || (q.sizing?.tipo_ligacao ?? "").toLowerCase();
  const tarifa = q.sizing?.tarifa_kwh ?? company.tarifa_kwh;
  const meses = monthlyGeneration(kwp, company.hsp_mensal, q.sizing?.hsp ?? company.hsp_padrao);
  const anual = meses.reduce((a, b) => a + b, 0);
  const media = anual / 12;
  const economiaMes = media * tarifa;
  const paybackMeses = economiaMes > 0 ? q.total / economiaMes : null;
  const maxMes = Math.max(...meses, 1);

  const local = q.local_instalacao || localLabel(c) || "—";
  const localCurto = c.city ? localLabel(c, "/") : local;
  const created = q.created_at ? new Date(q.created_at) : new Date();
  const dataExtenso = created.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const sz = q.sizing ?? {};
  const temBateria = q.items.some((it: any) => /bateria/i.test(`${it.component ?? ""} ${it.description}`));
  const sistema: string = sz.tipo_sistema && sz.tipo_sistema !== "On-Grid" ? sz.tipo_sistema : temBateria ? "Híbrido" : "On-Grid";
  const offGrid = sistema === "Off-Grid";
  const semBateria = sistema === "Híbrido" && sz.tipo_bateria === "Sem bateria";
  const titulo = !solar ? q.service_type
    : offGrid ? "Sistema fotovoltaico off-grid (isolado) com baterias"
    : semBateria ? "Sistema fotovoltaico híbrido preparado para baterias"
    : sistema === "Híbrido" ? "Sistema fotovoltaico híbrido com baterias"
    : "Sistema de geração de energia solar fotovoltaica";
  const escopo = q.notes || company.escopo_padrao;
  const pagamento: string[] = (q.payment_terms || "").split("\n").map((l: string) => l.trim()).filter(Boolean);

  const observacoes: string[] = [];
  if (solar && inv) {
    observacoes.push(
      `A potência dos módulos é de ${num(kwp, 2)} kWp em corrente contínua, associada a inversor ${fase ? fase + " " : ""}de ${num(inv.kw, 1).replace(/,0$/, "")} kW em corrente alternada (relação CC/CA de ${num(kwp / inv.kw, 2)}). ` +
      "Antes da instalação, devem ser confirmados na ficha técnica do inversor a potência FV máxima admissível, tensão máxima, corrente por MPPT e configuração das strings.",
    );
  }
  const obsPadrao = (company.observacoes_padrao ?? "").split("\n").map((l: string) => l.trim()).filter(Boolean);
  if (!solar) obsPadrao.splice(0, obsPadrao.length, ...obsPadrao.filter((l: string) => !/gera[çc][ãa]o|dimensionamento/i.test(l)));
  observacoes.push(...obsPadrao);
  if (solar && sz.num_baterias) {
    observacoes.splice(inv ? 1 : 0, 0,
      `Banco de baterias: ${sz.num_baterias} × ${sz.tipo_bateria} ${sz.bateria_unidade} — ${num(sz.banco_kwh, 1)} kWh nominais e ${num(sz.banco_util_kwh, 1)} kWh utilizáveis` +
      (offGrid ? `, autonomia estimada de ${num(sz.autonomia_dias, 1)} dia(s) sem sol.` : `, reserva de cerca de ${num(sz.horas_backup, 1)} h para ${num(sz.carga_essencial_kw, 1)} kW de cargas essenciais quando faltar energia da rede.`) +
      ` Vida útil estimada das baterias: ${sz.vida_bateria_anos} anos.`);
  }
  if (solar && semBateria) {
    observacoes.splice(inv ? 1 : 0, 0,
      "Sistema preparado para expansão com baterias: o inversor híbrido permite instalar o banco de baterias futuramente, sem trocar o equipamento. Baterias não inclusas nesta proposta.");
  }
  if (solar && offGrid) {
    observacoes.splice(0, 0, "Sistema isolado da rede da concessionária: toda a energia consumida vem das placas e das baterias. O consumo deve respeitar a capacidade do banco, principalmente em dias nublados.");
  }
  const validade = `Validade desta proposta: ${q.validity_days} dias.`;
  if (observacoes.length) observacoes[observacoes.length - 1] += ` ${validade}`;
  else observacoes.push(validade);

  let n = 0;
  const header = (
    <header className="flex items-start gap-5">
      <img src={company.logo || DEFAULT_LOGO} alt="" className="h-[105px] w-[115px] object-contain" />
      <div className="flex-1 pt-2">
        <p className="max-w-[330px] text-[25px] font-bold uppercase leading-tight" style={{ color: NAVY }}>{company.name}</p>
        {company.slogan && <p className="mt-1 text-[12px] text-zinc-600">{company.slogan}</p>}
        <p className="text-[12px] text-zinc-600">{[company.phone && `WhatsApp: ${company.phone}`, company.email].filter(Boolean).join(" • ")}</p>
      </div>
      <div className="pt-6 text-right text-[11px] text-zinc-500">
        <p className="font-bold uppercase text-zinc-600">Proposta comercial</p>
        <p>{dataExtenso}</p>
      </div>
    </header>
  );

  const page1 = (
    <>
      {header}
      <h1 className="mb-3 mt-5 text-[25px] font-bold leading-tight" style={{ color: NAVY }}>{titulo}</h1>
      <div className="grid grid-cols-3 border border-[#d5e1ee] bg-[#eaf1f9]">
        {[["Cliente", c.name], ["Local de instalação", local], ["Investimento", brl(q.total)]].map(([k, v], i) => (
          <div key={k} className={`px-3 py-2.5 ${i ? "border-l border-[#d5e1ee]" : ""}`}>
            <p className="text-[12px] font-bold uppercase text-zinc-800">{k}</p>
            <p className={i === 2 ? "font-bold" : ""} style={i === 2 ? { color: NAVY } : undefined}>{v}</p>
          </div>
        ))}
      </div>

      <H2 n={++n}>{solar ? "Configuração do sistema" : "Itens e serviços"}</H2>
      {solar && <p className="mb-2">Com base na relação de equipamentos apresentada, a proposta considera o seguinte conjunto fotovoltaico:</p>}
      <table className="w-full border border-[#d5e1ee]">
        <thead style={{ background: NAVY }}>
          <tr>
            <th className={`${th} w-[28%]`}>Componente</th>
            <th className={th}>Especificação</th>
            <th className={`${th} w-[11%]`}>Qtd.</th>
            {!solar && <th className={`${th} w-[16%] text-right`}>Valor</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it: any, i: number) => {
            const p = it.product_id ? productById[it.product_id] : null;
            const comp = it.component || (p && COMPONENTE_POR_CATEGORIA[p.category]) || p?.category || "";
            return (
              <tr key={i} className={i % 2 ? "bg-[#f4f8fc]" : ""}>
                <td className={`${cellBorder} px-3 py-2 font-bold`}>{comp || it.description}</td>
                <td className={`${cellBorder} px-3 py-2 text-[11.5px]`}>{comp ? it.description : ""}</td>
                <td className={`${cellBorder} px-3 py-2 text-center text-[14px]`}>{qtyText(it, p)}</td>
                {!solar && <td className={`${cellBorder} px-3 py-2.5 text-right`}>{brl(it.quantity * it.unit_price)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>

      {solar && (
        <div className={`mt-2.5 grid border border-[#d5e1ee] ${sz.banco_kwh ? "grid-cols-4" : "grid-cols-3"}`}>
          {[[`${num(kwp, 2)} kWp`, "Potência instalada em módulos"], [`${num(media)} kWh/mês`, "Geração média estimada"], [`${num(anual)} kWh/ano`, "Geração anual estimada"],
            ...(sz.banco_kwh ? [[`${num(sz.banco_kwh, 1)} kWh`, "Banco de baterias"]] : [])].map(([v, l], i) => (
            <div key={l} className={i ? "border-l border-[#d5e1ee]" : ""}>
              <p className="py-2 text-center text-[22px] font-bold" style={{ color: NAVY }}>{v}</p>
              <p className="border-t border-[#d5e1ee] bg-[#f4f8fc] py-1.5 text-center text-[10.5px] text-zinc-500">{l}</p>
            </div>
          ))}
        </div>
      )}

      {escopo && (
        <>
          <H2 n={++n}>O que está contemplado</H2>
          <p className="whitespace-pre-line leading-relaxed">{escopo}</p>
        </>
      )}

      <H2 n={++n}>Investimento e condições de pagamento</H2>
      <table className="w-full border border-[#d5e1ee]">
        <thead style={{ background: NAVY }}>
          <tr><th className={`${th} w-[33%]`}>Valor total do investimento</th><th className={th}>Condição de pagamento</th></tr>
        </thead>
        <tbody className="bg-[#eaf1f9]">
          <tr>
            <td className="px-3 py-4 text-[22px] font-bold" style={{ color: NAVY }}>
              {brl(q.total)}
              {q.discount > 0 && <span className="block text-[11px] font-normal text-zinc-500">Já com desconto de {brl(q.discount)}</span>}
            </td>
            <td className="border-l border-[#d5e1ee] px-3 py-3 leading-relaxed">
              {pagamento.length ? pagamento.map((l, i) => {
                const k = l.indexOf(":");
                return <p key={i}>{k > 0 ? <><b>{l.slice(0, k + 1)}</b>{l.slice(k + 1)}</> : l}</p>;
              }) : <p>A combinar.</p>}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  const nObs = solar ? n + 3 : n + 1;
  const final = (
    <>
      <H2 n={nObs}>Observações técnicas e comerciais</H2>
      <div className="space-y-0.5 text-[11px] leading-snug text-zinc-700">
        {observacoes.map((o, i) => <p key={i}>• {o}</p>)}
      </div>

      <H2 n={nObs + 1}>Aceite da proposta</H2>
      <div className="mt-8 grid grid-cols-2 gap-16">
        {[[company.name, company.responsavel_tecnico ? `Responsável: ${company.responsavel_tecnico}` : ""], [c.name, "Contratante"]].map(([nome, sub]) => (
          <div key={nome}>
            <div className="border-t border-zinc-700" />
            <p className="mt-2 text-[11px] font-bold uppercase text-zinc-600">{nome}</p>
            <p className="text-[11px] text-zinc-600">{sub}</p>
            <p className="mt-3 text-[14px]">Data: ____/____/________</p>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="min-h-screen space-y-6 bg-zinc-200 py-8 print:space-y-0 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 0; } @media print { .sheet { break-after: page; height: 297mm; overflow: hidden; } .sheet:last-child { break-after: auto; } }`}</style>
      <div className="no-print mx-auto flex w-[210mm] justify-end">
        <button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir / Salvar PDF</button>
      </div>

      <Sheet company={company} page={1}>{page1}{!solar && final}</Sheet>

      {solar && (
        <Sheet company={company} page={2}>
          <h1 className="mb-3 text-[25px] font-bold leading-tight" style={{ color: NAVY }}>Geração estimada e retorno do investimento</h1>

          <H2 n={n + 1}>Estimativa de geração mensal</H2>
          <p className="leading-relaxed">
            Simulação preliminar para {localCurto}, considerando potência de {num(kwp, 2)} kWp, desempenho global de {Math.round(EFICIENCIA * 100)}% e
            irradiação solar mensal de referência local. A geração média calculada é de aproximadamente {num(media)} kWh/mês, totalizando
            cerca de {num(anual)} kWh/ano.
          </p>
          <div className="mt-3 pl-10">
            <p className="mb-2 text-[11px] font-bold" style={{ color: NAVY }}>Geração estimada (kWh/mês)</p>
            <div className="flex h-[150px] items-end gap-[14px] border-b border-zinc-300 px-2">
              {meses.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                  <span className="mb-0.5 text-[9.5px] text-zinc-600">{num(v)}</span>
                  <div className="w-full" style={{ height: `${(v / (maxMes * 1.12)) * 100}%`, background: "#1f68b0" }} />
                </div>
              ))}
            </div>
            <div className="flex gap-[14px] px-2 pt-1">
              {MESES.map((m) => <span key={m} className="flex-1 text-center text-[10px] text-zinc-500">{m}</span>)}
            </div>
          </div>

          <H2 n={n + 2}>Simulação de economia e payback simples</H2>
          <table className="w-full border border-[#d5e1ee]">
            <thead style={{ background: NAVY }}><tr><th className={`${th} w-[56%]`}>Indicador</th><th className={th}>Estimativa</th></tr></thead>
            <tbody>
              {[
                ["Geração média de referência", `${num(media)} kWh/mês`],
                ["Tarifa de energia usada na simulação", `${brl(tarifa)}/kWh`],
                [offGrid ? "Valor da energia gerada (mensal)" : "Economia bruta teórica mensal", brl(economiaMes)],
                [offGrid ? "Valor da energia gerada (anual)" : "Economia bruta teórica anual", brl(economiaMes * 12)],
                ["Investimento", brl(q.total)],
                ["Payback simples estimado", offGrid ? "Não se aplica — sistema isolado (comparar com o custo de levar a rede ou de um gerador)" : paybackMeses ? `${num(paybackMeses, 1)} meses • aproximadamente ${num(paybackMeses / 12, 1)} anos` : "—"],
              ].map(([k, v], i) => (
                <tr key={k} className={i % 2 ? "bg-[#f4f8fc]" : ""}>
                  <td className={`${cellBorder} px-3 py-1.5`}>{k}</td>
                  <td className={`${cellBorder} border-l px-3 py-1.5 font-bold`}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[10.5px] leading-snug text-zinc-600">
            <b>Importante:</b> o payback acima é uma simulação simplificada, considerando que toda a energia estimada gere benefício econômico à
            tarifa de referência de {brl(tarifa)}/kWh. O retorno efetivo pode variar conforme tarifa e classe de consumo, consumo simultâneo,
            compensação de créditos, cobrança de componentes da rede (Lei 14.300), custo de disponibilidade, impostos, orientação/inclinação,
            sombreamento, temperatura e perdas do sistema.
          </p>

          {final}
        </Sheet>
      )}
    </div>
  );
}
