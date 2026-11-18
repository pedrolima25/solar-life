"use client";

import {
  ArrowDown, BatteryCharging, CalendarCheck, Home, MessageCircle, PiggyBank, Printer, ShieldCheck, Sun, TrendingUp, Zap,
} from "lucide-react";
import { useEffect } from "react";
import { PaybackChart } from "@/components/Sizing";
import { brl, num, whatsappLink } from "@/lib/format";
import { COMPONENTE_POR_CATEGORIA, DEFAULT_LOGO, quoteEconomics } from "@/lib/proposal";

const NAVY = "#0b3a74";
const POUPANCA_ANO = 0.06; // referência aproximada de rendimento da poupança

const PASSOS: Record<string, { icon: any; title: string; text: string }[]> = {
  "On-Grid": [
    { icon: Sun, title: "As placas captam o sol", text: "Durante o dia, os painéis no telhado transformam a luz do sol em energia." },
    { icon: Home, title: "Sua casa usa essa energia", text: "O inversor entrega a energia para tomadas, ar-condicionado, geladeira… tudo funciona normalmente." },
    { icon: PiggyBank, title: "O que sobra vira crédito", text: "A energia que você não usa vai para a rede e vira desconto na conta, usado à noite e nos dias nublados." },
  ],
  "Off-Grid": [
    { icon: Sun, title: "As placas captam o sol", text: "Os painéis transformam a luz do sol em energia, sem depender da rede elétrica." },
    { icon: BatteryCharging, title: "As baterias guardam", text: "A energia que sobra durante o dia fica guardada nas baterias." },
    { icon: Home, title: "Energia dia e noite", text: "À noite e em dias nublados, sua casa usa a energia das baterias. Sem conta de luz." },
  ],
  Híbrido: [
    { icon: Sun, title: "As placas captam o sol", text: "Os painéis geram energia para a casa durante o dia." },
    { icon: PiggyBank, title: "Sobra vira crédito", text: "O excedente vai para a rede e vira desconto na sua conta de luz." },
    { icon: BatteryCharging, title: "Faltou luz? Bateria entra", text: "Quando a rede cai, as baterias mantêm funcionando o que é essencial na sua casa." },
  ],
};

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`break-inside-avoid rounded-3xl bg-white p-6 shadow-sm sm:p-8 print:shadow-none print:ring-1 print:ring-zinc-200 ${className}`}>{children}</section>;
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-xl font-bold sm:text-2xl" style={{ color: NAVY }}>{children}</h2>;
}

/** Apresentação comercial para o cliente (usada na tela interna e no link público). */
export function Presentation({ q, company, clientName, products = [], toolbar }: {
  q: any;
  company: any;
  clientName: string;
  products?: any[];
  toolbar?: React.ReactNode;
}) {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (wasDark) html.classList.add("dark"); };
  }, []);

  const c = { name: clientName };
  const e = quoteEconomics(q, company);
  const primeiroNome = (c.name || "").split(" ")[0];
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));
  const incluso = Array.from(new Set(
    q.items.filter((it: any) => it.description !== "Desconto").map((it: any) => {
      const p = it.product_id ? productById[it.product_id] : null;
      const cat = it.category ?? p?.category;
      return it.component || (cat && COMPONENTE_POR_CATEGORIA[cat]) || it.description;
    }),
  )) as string[];
  const pagamento: string[] = (q.payment_terms || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
  const passos = PASSOS[e.sistema] ?? PASSOS["On-Grid"];
  const offGrid = e.sistema === "Off-Grid";
  const sz = e.sz;
  const wa = whatsappLink(company.phone, `Olá! Vi a proposta de energia solar nº ${q.number} (${brl(q.total)}) e quero conversar para fechar.`);
  const economiaPct = e.contaAtual ? Math.round((1 - (e.contaNova ?? 0) / e.contaAtual) * 100) : null;
  const vezesPoupanca = e.rendimentoAno / POUPANCA_ANO;

  return (
    <div className="min-h-screen bg-[#eef3f9] pb-16 text-zinc-800 print:bg-white">
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      {toolbar !== null && (
        <div className="no-print sticky top-0 z-10 flex flex-wrap justify-end gap-2 bg-[#eef3f9]/90 px-4 py-3 backdrop-blur">
          {toolbar ?? <button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Salvar PDF para enviar</button>}
        </div>
      )}

      <main className="mx-auto max-w-3xl space-y-5 px-4">
        {/* Capa */}
        <section className="break-inside-avoid overflow-hidden rounded-3xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1f68b0 60%, #f59e0b 140%)` }}>
          <div className="flex items-center gap-4 p-6 sm:p-8">
            <img src={company.logo || DEFAULT_LOGO} alt="" className="h-16 w-16 rounded-2xl bg-white object-contain p-1 sm:h-20 sm:w-20" />
            <div>
              <p className="text-lg font-bold leading-tight sm:text-xl">{company.name}</p>
              {company.slogan && <p className="text-sm text-white/80">{company.slogan}</p>}
            </div>
          </div>
          <div className="px-6 pb-8 sm:px-8 sm:pb-10">
            <p className="text-sm uppercase tracking-widest text-white/70">Proposta para</p>
            <h1 className="text-3xl font-extrabold sm:text-5xl">{c.name}</h1>
            <p className="mt-3 max-w-xl text-white/90 sm:text-lg">
              {offGrid
                ? "Energia própria, sem depender da rede elétrica: o sol gera, as baterias guardam e a sua casa funciona dia e noite."
                : e.sistema === "Híbrido"
                  ? "Economia na conta de luz e tranquilidade quando faltar energia: o sol gera, a rede compensa e a bateria garante o essencial."
                  : "Gere a sua própria energia com o sol e pague muito menos na conta de luz todos os meses."}
            </p>
          </div>
        </section>

        {/* Conta hoje x com solar */}
        <Section>
          <H>{offGrid ? "Quanto vale a energia que você vai gerar" : "Sua conta de luz"}</H>
          {e.contaAtual !== null && !offGrid ? (
            <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-2xl bg-red-50 p-5 text-center">
                <p className="text-sm font-semibold uppercase text-red-600">Hoje</p>
                <p className="text-4xl font-extrabold text-red-600">{brl(e.contaAtual)}</p>
                <p className="text-sm text-red-600/80">por mês</p>
              </div>
              <ArrowDown className="mx-auto h-8 w-8 text-zinc-400 sm:-rotate-90" />
              <div className="rounded-2xl bg-emerald-50 p-5 text-center">
                <p className="text-sm font-semibold uppercase text-emerald-700">Com energia solar</p>
                <p className="text-4xl font-extrabold text-emerald-700">{brl(e.contaNova)}</p>
                <p className="text-sm text-emerald-700/80">por mês (aprox.)</p>
              </div>
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl p-5 text-center text-white" style={{ background: NAVY }}>
            <p className="text-sm uppercase tracking-wide text-white/70">{offGrid ? "Energia gerada vale cerca de" : "Você economiza cerca de"}</p>
            <p className="text-4xl font-extrabold sm:text-5xl">{brl(e.economiaMes)} <span className="text-lg font-semibold text-white/80">por mês</span></p>
            <p className="mt-1 text-white/80">
              {brl(e.economiaMes * 12)} por ano{economiaPct !== null && !offGrid ? ` · redução de ${economiaPct}% na conta` : ""}
            </p>
          </div>
        </Section>

        {/* Números grandes */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: CalendarCheck, label: "O sistema se paga em", value: offGrid ? "—" : e.payback ? `${num(e.payback, 1)} anos` : "+25 anos", hint: offGrid ? "Sem conta de luz para comparar" : "Depois disso, a economia é lucro" },
            { icon: TrendingUp, label: "Economia em 25 anos", value: brl(e.economia25), hint: "Com reajustes da tarifa de energia" },
            { icon: Zap, label: "Seu sistema", value: `${num(e.kwp, 2)} kWp`, hint: `Gera cerca de ${num(e.geracaoMes)} kWh por mês` },
          ].map((k) => (
            <div key={k.label} className="break-inside-avoid rounded-3xl bg-white p-5 text-center shadow-sm print:shadow-none print:ring-1 print:ring-zinc-200">
              <k.icon className="mx-auto h-7 w-7 text-amber-500" />
              <p className="mt-2 text-sm text-zinc-500">{k.label}</p>
              <p className="text-2xl font-extrabold" style={{ color: NAVY }}>{k.value}</p>
              <p className="text-xs text-zinc-500">{k.hint}</p>
            </div>
          ))}
        </div>

        {/* Comparação com a poupança */}
        {!offGrid && e.rendimentoAno > 0 && (
          <Section>
            <H>Melhor que deixar o dinheiro parado</H>
            <p className="mb-4 text-zinc-600">Comparando o que o valor investido traz de retorno em 1 ano:</p>
            <div className="space-y-3">
              {[
                { label: "Poupança (aprox.)", pct: POUPANCA_ANO, value: e.investimento * POUPANCA_ANO, color: "#a1a1aa" },
                { label: "Energia solar (economia na conta)", pct: e.rendimentoAno, value: e.economiaMes * 12, color: "#10b981" },
              ].map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{b.label}</span><span>{brl(b.value)} · {num(b.pct * 100, 1)}% ao ano</span></div>
                  <div className="h-4 rounded-full bg-zinc-100">
                    <div className="h-4 rounded-full" style={{ width: `${Math.min((b.pct / Math.max(e.rendimentoAno, POUPANCA_ANO)) * 100, 100)}%`, background: b.color }} />
                  </div>
                </div>
              ))}
            </div>
            {vezesPoupanca >= 1.2 && (
              <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-center font-semibold text-emerald-800">
                O retorno da energia solar é cerca de {num(vezesPoupanca, 1)}× o da poupança — e ainda aumenta quando a tarifa sobe.
              </p>
            )}
          </Section>
        )}

        {/* Como funciona */}
        <Section>
          <H>Como funciona</H>
          <div className="grid gap-4 sm:grid-cols-3">
            {passos.map((p, i) => (
              <div key={p.title} className="rounded-2xl bg-[#f4f8fc] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: NAVY }}>{i + 1}</span>
                  <p.icon className="h-6 w-6 text-amber-500" />
                </div>
                <p className="font-bold" style={{ color: NAVY }}>{p.title}</p>
                <p className="text-sm text-zinc-600">{p.text}</p>
              </div>
            ))}
          </div>
          {sz?.num_baterias ? (
            <p className="mt-4 text-sm text-zinc-600">
              <b>Suas baterias:</b> {num(sz.banco_util_kwh, 1)} kWh de energia guardada —{" "}
              {offGrid ? `cerca de ${num(sz.autonomia_dias, 1)} dia(s) de consumo sem sol.` : `cerca de ${num(sz.horas_backup, 1)} horas mantendo ${num(sz.carga_essencial_kw, 1)} kW de aparelhos essenciais quando faltar luz.`}
            </p>
          ) : null}
        </Section>

        {/* Retorno ano a ano */}
        {!offGrid && (
          <Section>
            <H>Seu dinheiro ano a ano</H>
            <PaybackChart r={{ fluxo: e.fluxo, investimento: e.investimento, custo_baterias: sz?.custo_baterias }} />
          </Section>
        )}

        {/* O que está incluso */}
        <Section>
          <H>O que está incluso</H>
          <ul className="grid gap-2 sm:grid-cols-2">
            {incluso.map((i) => (
              <li key={i} className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" /> {i}</li>
            ))}
            {!offGrid && <li className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" /> Instalação e configuração completas</li>}
          </ul>
        </Section>

        {/* Investimento */}
        <Section className="text-center">
          <H>Investimento</H>
          <p className="text-5xl font-extrabold" style={{ color: NAVY }}>{brl(q.total)}</p>
          {pagamento.length > 0 && (
            <div className="mx-auto mt-4 max-w-md space-y-1 rounded-2xl bg-[#f4f8fc] p-4 text-left">
              {pagamento.map((l, i) => {
                const k = l.indexOf(":");
                return <p key={i}>{k > 0 ? <><b>{l.slice(0, k + 1)}</b>{l.slice(k + 1)}</> : l}</p>;
              })}
            </div>
          )}
          {wa && (
            <a href={wa} target="_blank" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-lg font-bold text-white shadow-lg hover:bg-emerald-600">
              <MessageCircle className="h-5 w-5" /> Quero fechar, {primeiroNome || "vamos conversar"}!
            </a>
          )}
          <p className="mt-4 text-sm text-zinc-500">
            {[company.phone && `WhatsApp ${company.phone}`, company.email].filter(Boolean).join(" · ")}
          </p>
        </Section>

        <p className="px-2 text-center text-xs text-zinc-500">
          Valores estimados com tarifa de {brl(e.tarifa)}/kWh e irradiação solar média da região. A economia real depende do consumo,
          da tarifa e das regras da concessionária. Proposta válida por {q.validity_days} dias.
        </p>
      </main>
    </div>
  );
}
