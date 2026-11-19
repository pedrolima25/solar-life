"use client";

import { CheckCircle2, Eye, FileText, Link2, MessageCircle, Pencil, Plus, Presentation, Printer, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ItemsEditor, itemsTotal, type Item, type Product } from "@/components/ItemsEditor";
import { EMPTY_SIZING, SizingForm, SizingResult, sizingInputFrom, suggestItems, type SizingInput } from "@/components/Sizing";
import { Empty, ErrorBox, Field, Loading, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { QUOTE_STATUS, SERVICE_TYPES } from "@/lib/constants";
import { brl, date, dateTime, num, todayISO, whatsappLink } from "@/lib/format";
import { defaultPaymentTerms, kwpFromItems, localLabel } from "@/lib/proposal";
import { useApi } from "@/lib/hooks";

type QuoteForm = {
  id?: string;
  client_id: string;
  installation_id: string | null;
  service_type: string;
  status: string;
  sizing: any;
  sizingInput: SizingInput;
  discount: number;
  valor_investimento: number | null; // vazio = soma dos itens − desconto
  payment_terms: string;
  validity_days: number;
  notes: string;
  local_instalacao: string;
  potencia_kwp: number | null;
  items: Item[];
};

const EMPTY: QuoteForm = {
  client_id: "", installation_id: null, service_type: "Instalação Solar", status: "Rascunho", sizing: null,
  sizingInput: EMPTY_SIZING, discount: 0, valor_investimento: null, payment_terms: "", validity_days: 15, notes: "", local_instalacao: "", potencia_kwp: null, items: [],
};

function OrcamentosContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const { data: quotes = [], loading, error, reload } = useApi<any[]>(`/quotes${statusFilter ? `?status=${statusFilter}` : ""}`, []);
  const { data: clients = [] } = useApi<any[]>("/clients", []);
  const { data: products = [] } = useApi<Product[]>("/products", []);
  const [form, setForm] = useState<QuoteForm | null>(null);
  const [approving, setApproving] = useState<any>(null);
  const suggested = useRef(false);

  const handledParams = useRef<string | null>(null);

  useEffect(() => {
    // Evita processar o mesmo link duas vezes (o React em desenvolvimento roda o efeito em dobro)
    const key = params.toString();
    if (!key || handledParams.current === key) return;
    handledParams.current = key;
    if (params.get("novo") === "solar") {
      const pending = JSON.parse(sessionStorage.getItem("pending_sizing") || "null");
      sessionStorage.removeItem("pending_sizing");
      setForm({ ...EMPTY, sizingInput: pending?.input ?? EMPTY_SIZING, sizing: pending?.result ?? null });
      router.replace("/orcamentos");
    } else if (params.get("novo")) {
      setForm({ ...EMPTY });
      router.replace("/orcamentos");
    }
  }, [params, router]);

  // Quando o catálogo chega e o orçamento veio do simulador sem itens, sugere itens
  useEffect(() => {
    if (!form) suggested.current = false;
    else if (!suggested.current && !form.id && form.sizing && form.items.length === 0 && products.length) {
      suggested.current = true;
      setForm({ ...form, items: suggestItems(form.sizing, products) });
    }
  }, [form, products]);

  function edit(q: any) {
    setForm({
      id: q.id, client_id: q.client_id, installation_id: q.installation_id, service_type: q.service_type, status: q.status,
      sizing: q.sizing, sizingInput: sizingInputFrom(q.sizing),
      discount: q.discount, valor_investimento: q.valor_investimento ?? null, payment_terms: q.payment_terms ?? "", validity_days: q.validity_days, notes: q.notes ?? "",
      local_instalacao: q.local_instalacao ?? "", potencia_kwp: q.potencia_kwp ?? null,
      items: q.items.map(({ product_id, description, quantity, unit_price, component, qty_label }: any) => ({ product_id, description, quantity, unit_price, component, qty_label })),
    });
  }

  async function remove(q: any) {
    if (!confirm(`Excluir o orçamento #${q.number}?`)) return;
    await api(`/quotes/${q.id}`, { method: "DELETE" }).catch((e) => alert(e.message));
    reload();
  }

  /** Gera (ou reaproveita) o link público da apresentação deste orçamento. */
  async function shareLink(q: any) {
    const r = await api(`/quotes/${q.id}/share`, { method: "POST" });
    return `${window.location.origin}/p/${r.token}`;
  }

  async function sendWhatsApp(q: any, client: any) {
    // Abre a janela já no clique (navegadores bloqueiam pop-up aberto depois de esperar a API)
    const win = window.open("", "_blank");
    try {
      const link = await shareLink(q);
      const nome = (client?.name || "").split(" ")[0];
      const msg = `Olá${nome ? " " + nome : ""}! Tudo bem? 😊

Preparamos a sua proposta de energia solar. É só abrir o link para ver quanto você vai economizar:

${link}

Qualquer dúvida, estou à disposição!`;
      const wa = whatsappLink(client?.phone, msg);
      if (wa && win) win.location.href = wa;
      else { win?.close(); await navigator.clipboard?.writeText(link); alert("Cliente sem telefone. Link copiado:\n" + link); }
      reload();
    } catch (e: any) {
      win?.close();
      alert(e.message);
    }
  }

  async function copyLink(q: any) {
    try {
      const link = await shareLink(q);
      try { await navigator.clipboard.writeText(link); alert("Link copiado! Cole no WhatsApp ou e-mail do cliente:\n\n" + link); }
      catch { prompt("Copie o link da proposta:", link); }
      reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function setStatus(q: any, status: string) {
    const body = { ...q, status, items: q.items };
    await api(`/quotes/${q.id}`, { method: "PUT", json: body }).catch((e) => alert(e.message));
    reload();
  }

  return (
    <>
      <PageHeader title="Orçamentos" subtitle="Propostas de energia solar, manutenção e serviços elétricos">
        <select className="input w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {QUOTE_STATUS.map((s) => <option key={s.id}>{s.id}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" /> Novo orçamento</button>
      </PageHeader>

      <ErrorBox message={error} />
      <div className="card overflow-x-auto">
        {loading ? <Loading /> : quotes.length === 0 ? <Empty icon={FileText} text="Nenhum orçamento." /> : (
          <table className="table-base">
            <thead><tr><th>Nº</th><th>Cliente</th><th>Serviço</th><th>Data</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {quotes.map((q) => {
                const client = clients.find((c) => c.id === q.client_id);
                return (
                  <tr key={q.id}>
                    <td className="font-semibold">#{q.number}</td>
                    <td>
                      {q.client?.name}
                      {q.share_views > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500"
                          title={`Último acesso: ${dateTime(q.share_last_view)}`}>
                          <Eye className="h-3 w-3" /> Cliente abriu {q.share_views}x
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground">{q.service_type}{q.sizing ? ` · ${q.sizing.tipo_sistema && q.sizing.tipo_sistema !== "On-Grid" ? q.sizing.tipo_sistema + " · " : ""}${q.sizing.kwp_real} kWp` : ""}</td>
                    <td className="text-muted-foreground">{date(q.created_at?.slice(0, 10))}</td>
                    <td>
                      {q.status === "Aprovado" ? <StatusBadge status={q.status} list={QUOTE_STATUS} /> : (
                        <select className="rounded-lg border border-border bg-background px-2 py-1 text-xs" value={q.status} onChange={(e) => setStatus(q, e.target.value)}>
                          {QUOTE_STATUS.filter((s) => s.id !== "Aprovado").map((s) => <option key={s.id}>{s.id}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="text-right font-semibold">{brl(q.total)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {q.status !== "Aprovado" && (
                          <button className="rounded-lg p-2 text-emerald-500 hover:bg-muted" title="Aprovar" onClick={() => setApproving(q)}><CheckCircle2 className="h-4 w-4" /></button>
                        )}
                        <button className="rounded-lg p-2 text-emerald-500 hover:bg-muted" title="Enviar link pelo WhatsApp" onClick={() => sendWhatsApp(q, client)}><MessageCircle className="h-4 w-4" /></button>
                        <button className="rounded-lg p-2 hover:bg-muted" title="Copiar link da proposta" onClick={() => copyLink(q)}><Link2 className="h-4 w-4" /></button>
                        <Link href={`/apresentacao/${q.id}`} target="_blank" className="rounded-lg p-2 text-amber-500 hover:bg-muted" title="Apresentação para o cliente"><Presentation className="h-4 w-4" /></Link>
                        <Link href={`/imprimir/orcamento/${q.id}`} target="_blank" className="rounded-lg p-2 hover:bg-muted" title="Imprimir / PDF"><Printer className="h-4 w-4" /></Link>
                        {q.status !== "Aprovado" && <button className="rounded-lg p-2 hover:bg-muted" title="Editar" onClick={() => edit(q)}><Pencil className="h-4 w-4" /></button>}
                        {q.status !== "Aprovado" && <button className="rounded-lg p-2 text-red-500 hover:bg-muted" title="Excluir" onClick={() => remove(q)}><Trash2 className="h-4 w-4" /></button>}
                        {q.os_id && <Link href={`/os?abrir=${q.os_id}`} className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-muted">Ver OS</Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {form && <QuoteModal form={form} setForm={setForm} clients={clients} products={products} onSaved={() => { setForm(null); reload(); }} />}
      {approving && <ApproveModal quote={approving} onClose={() => setApproving(null)} onDone={() => { setApproving(null); reload(); }} />}
    </>
  );
}

function QuoteModal({ form, setForm, clients, products, onSaved }: {
  form: QuoteForm;
  setForm: React.Dispatch<React.SetStateAction<QuoteForm | null>>;
  clients: any[];
  products: Product[];
  onSaved: () => void;
}) {
  const { data: installations = [] } = useApi<any[]>(form.client_id ? `/installations?client_id=${form.client_id}` : null, []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isSolar = form.service_type === "Instalação Solar";
  const subtotal = itemsTotal(form.items);
  const set = (patch: Partial<QuoteForm>) => setForm({ ...form, ...patch });
  const totalItens = Math.max(subtotal - (form.discount || 0), 0);
  const total = form.valor_investimento || totalItens;
  const kwpItens = kwpFromItems(form.items);
  const client = clients.find((c) => c.id === form.client_id);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const { id, sizingInput, ...body } = form;
      await api(id ? `/quotes/${id}` : "/quotes", {
        method: id ? "PUT" : "POST",
        json: { ...body, sizing: isSolar ? form.sizing : null, installation_id: form.installation_id || null },
      });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={form.id ? "Editar orçamento" : "Novo orçamento"} onClose={() => setForm(null)} size="2xl"
      footer={<>
        <span className="mr-auto self-center text-sm">Total: <b className="text-lg">{brl(total)}</b></span>
        <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
        <button className="btn-primary" disabled={saving || !form.client_id || form.items.length === 0} onClick={save}>Salvar orçamento</button>
      </>}>
      <ErrorBox message={error} />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Cliente">
            <select className="input" value={form.client_id} onChange={(e) => set({ client_id: e.target.value, installation_id: null })}>
              <option value="">Selecione...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo de serviço">
            <select className="input" value={form.service_type} onChange={(e) => set({ service_type: e.target.value })}>
              {SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Instalação (opcional)">
            <select className="input" value={form.installation_id ?? ""} disabled={!form.client_id} onChange={(e) => set({ installation_id: e.target.value || null })}>
              <option value="">—</option>
              {installations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
        </div>

        {isSolar && (
          <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-primary">Dimensionamento do sistema fotovoltaico</h3>
              <button type="button" className="btn-ghost py-1.5 text-xs" disabled={!form.sizing}
                onClick={() => set({ items: suggestItems(form.sizing, products) })}>
                <Sparkles className="h-4 w-4" /> Gerar itens automaticamente
              </button>
            </div>
            <SizingForm input={form.sizingInput} onInput={(v) => set({ sizingInput: v })} onResult={(r) => setForm((f) => (f ? { ...f, sizing: r } : f))} />
            {form.sizing && <div className="mt-4"><SizingResult r={form.sizing} compact /></div>}
          </section>
        )}

        <section>
          <h3 className="mb-3 font-semibold">Itens e serviços</h3>
          <ItemsEditor items={form.items} onChange={(items) => set({ items })} products={products} proposal />
          {kwpItens > 0 && <p className="mt-2 text-xs text-muted-foreground">Potência pelos módulos dos itens: <b>{num(kwpItens, 2)} kWp</b> — usada na proposta impressa.</p>}
        </section>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Valor do investimento (R$)" className="sm:col-span-2">
            <input className="input font-semibold" type="number" min={0} step="0.01" placeholder={`${brl(totalItens)} (soma dos itens)`}
              value={form.valor_investimento ?? ""} onChange={(e) => set({ valor_investimento: Number(e.target.value) > 0 ? Number(e.target.value) : null })} />
            <p className="mt-1 text-xs text-muted-foreground">
              {form.valor_investimento
                ? <>Valor digitado vai para a proposta (itens somam {brl(subtotal)}). <button type="button" className="text-primary underline" onClick={() => set({ valor_investimento: null })}>Voltar para a soma dos itens</button></>
                : "Em branco = soma dos itens menos o desconto."}
            </p>
          </Field>
          <Field label="Desconto (R$)"><input className="input" type="number" min={0} step="0.01" disabled={!!form.valor_investimento}
            title={form.valor_investimento ? "Não se aplica com valor do investimento digitado" : undefined}
            value={form.valor_investimento ? "" : form.discount} onChange={(e) => set({ discount: Number(e.target.value) })} /></Field>
          <Field label="Validade (dias)"><input className="input" type="number" min={1} value={form.validity_days} onChange={(e) => set({ validity_days: Number(e.target.value) })} /></Field>
          <Field label="Local de instalação" className="sm:col-span-2">
            <input className="input" placeholder={localLabel(client) || "Ex.: Boa Vista, Roraima"} value={form.local_instalacao} onChange={(e) => set({ local_instalacao: e.target.value })} />
          </Field>
          <Field label="Potência kWp (opcional)" className="sm:col-span-2">
            <input className="input" type="number" step="0.01" min={0} placeholder={kwpItens ? `${num(kwpItens, 2)} (calculado pelos itens)` : "Calculado pelos módulos"}
              value={form.potencia_kwp ?? ""} onChange={(e) => set({ potencia_kwp: e.target.value ? Number(e.target.value) : null })} />
          </Field>
          <Field label="Condições de pagamento (uma por linha — o texto antes de “:” sai em negrito)" className="sm:col-span-2">
            <textarea className="input" rows={4} placeholder={"Entrada de 70%: R$ ...\n1ª parcela do saldo: R$ ... no início do serviço"} value={form.payment_terms} onChange={(e) => set({ payment_terms: e.target.value })} />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[[70, 2], [50, 1], [100, 0]].map(([pct, parc]) => (
                <button key={pct} type="button" className="btn-ghost px-2 py-1 text-xs" disabled={!total}
                  onClick={() => set({ payment_terms: pct === 100 ? `À vista: ${brl(total)}` : defaultPaymentTerms(total, pct, parc) })}>
                  {pct === 100 ? "À vista" : `${pct}% + ${parc}x`}
                </button>
              ))}
            </div>
          </Field>
          <Field label="O que está contemplado (em branco = texto padrão das Configurações)" className="sm:col-span-2">
            <textarea className="input" rows={4} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function ApproveModal({ quote, onClose, onDone }: { quote: any; onClose: () => void; onDone: () => void }) {
  const [createOs, setCreateOs] = useState(true);
  const [createReceivable, setCreateReceivable] = useState(true);
  const [installments, setInstallments] = useState(1);
  const [firstDue, setFirstDue] = useState(todayISO());
  const [error, setError] = useState("");

  async function approve() {
    try {
      await api(`/quotes/${quote.id}/approve`, {
        method: "POST",
        json: { create_os: createOs, create_receivable: createReceivable, installments, first_due: firstDue },
      });
      onDone();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <Modal title={`Aprovar orçamento #${quote.number}`} onClose={onClose} size="md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={approve}><CheckCircle2 className="h-4 w-4" /> Aprovar</button></>}>
      <ErrorBox message={error} />
      <p className="mb-4 text-sm">{quote.client?.name} · <b>{brl(quote.total)}</b></p>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createOs} onChange={(e) => setCreateOs(e.target.checked)} /> Gerar ordem de serviço</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createReceivable} onChange={(e) => setCreateReceivable(e.target.checked)} /> Lançar contas a receber no financeiro</label>
        {createReceivable && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <Field label="Parcelas"><input className="input" type="number" min={1} max={60} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} /></Field>
            <Field label="1º vencimento"><input className="input" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} /></Field>
            <p className="col-span-2 text-xs text-muted-foreground">{installments}x de {brl(quote.total / Math.max(installments, 1))}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function OrcamentosPage() {
  return <Suspense fallback={<Loading />}><OrcamentosContent /></Suspense>;
}
