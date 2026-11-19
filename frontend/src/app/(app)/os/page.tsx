"use client";

import { ClipboardList, LayoutGrid, List, MessageCircle, Plus, Printer, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import clsx from "clsx";
import { ItemsEditor, itemsTotal, type Item, type Product } from "@/components/ItemsEditor";
import { confirmDialog, focusFirstInvalid, toast } from "@/components/feedback";
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { CHECKLISTS, MEASUREMENT_FIELDS, OS_STATUS, PRIORITIES, SERVICE_TYPES } from "@/lib/constants";
import { brl, dateTime, toLocalInput, whatsappLink } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/hooks";

const PRIORITY_COLOR: Record<string, string> = {
  Baixa: "border-zinc-500/30 bg-zinc-500/10 text-zinc-500",
  Normal: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  Alta: "border-orange-500/30 bg-orange-500/10 text-orange-500",
  Urgente: "border-red-500/30 bg-red-500/10 text-red-500",
};

const WHATS: Record<string, string> = {
  Aberta: "recebemos sua solicitação e a ordem de serviço foi aberta",
  Agendada: "seu atendimento foi agendado",
  "Em Execução": "nossa equipe técnica iniciou o serviço",
  "Aguardando Material": "estamos aguardando a chegada de material para continuar o serviço",
  Concluída: "o serviço foi concluído. Obrigado pela confiança",
  Cancelada: "a ordem de serviço foi cancelada",
};

type OSForm = {
  id?: string; number?: number; client_id: string; installation_id: string | null; technician_id: string | null;
  service_type: string; priority: string; status: string; service_address: string; scheduled_date: string;
  problem: string; diagnosis: string; solution: string; checklist: { item: string; ok: boolean }[];
  measurements: Record<string, string>; warranty_days: number; art_number: string; items: Item[];
};

const EMPTY: OSForm = {
  client_id: "", installation_id: null, technician_id: null, service_type: "Manutenção Corretiva", priority: "Normal",
  status: "Aberta", service_address: "", scheduled_date: "", problem: "", diagnosis: "", solution: "",
  checklist: (CHECKLISTS["Manutenção Corretiva"] || []).map((item) => ({ item, ok: false })),
  measurements: {}, warranty_days: 90, art_number: "", items: [],
};

function OSContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: orders = [], loading, error, reload } = useApi<any[]>("/orders", []);
  const { data: clients = [] } = useApi<any[]>("/clients", []);
  const { data: users = [] } = useApi<any[]>("/users", []);
  const { data: products = [] } = useApi<Product[]>("/products", []);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [techFilter, setTechFilter] = useState("");
  const [form, setForm] = useState<OSForm | null>(null);
  const [notify, setNotify] = useState<{ os: any; status: string } | null>(null);
  const [mobileCol, setMobileCol] = useState("Aberta"); // coluna visível no celular
  const [colPicked, setColPicked] = useState(false);

  // No celular, abre na primeira aba que tem OS
  useEffect(() => {
    if (colPicked || orders.length === 0) return;
    const first = OS_STATUS.find((s) => orders.some((o) => o.status === s.id));
    if (first) setMobileCol(first.id);
    setColPicked(true);
  }, [orders, colPicked]);

  useEffect(() => {
    if (params.get("novo")) { setForm({ ...EMPTY }); router.replace("/os"); }
    const id = params.get("abrir");
    if (id) {
      api(`/orders/${id}`).then(openOrder).catch(() => null);
      router.replace("/os");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function openOrder(o: any) {
    setForm({
      id: o.id, number: o.number, client_id: o.client_id, installation_id: o.installation_id, technician_id: o.technician_id,
      service_type: o.service_type, priority: o.priority, status: o.status, service_address: o.service_address ?? "",
      scheduled_date: toLocalInput(o.scheduled_date), problem: o.problem ?? "", diagnosis: o.diagnosis ?? "",
      solution: o.solution ?? "",
      checklist: o.checklist ?? (CHECKLISTS[o.service_type] || []).map((item) => ({ item, ok: false })),
      measurements: o.measurements ?? {}, warranty_days: o.warranty_days, art_number: o.art_number ?? "",
      items: o.items.map(({ product_id, description, quantity, unit_price }: any) => ({ product_id, description, quantity, unit_price })),
    });
  }

  async function changeStatus(o: any, status: string) {
    if (o.status === status) return;
    try {
      await api(`/orders/${o.id}/status`, { method: "PATCH", json: { status } });
      toast.success(`OS #${o.number}: ${status}`);
      reload();
      const client = clients.find((c) => c.id === o.client_id);
      if (client?.phone) setNotify({ os: { ...o, client }, status });
    } catch (e) {
      toast.error(e, "Não foi possível mudar o status");
    }
  }

  const filtered = orders.filter((o) =>
    (!techFilter || o.technician_id === techFilter) &&
    (!search || `${o.number} ${o.client?.name} ${o.service_type}`.toLowerCase().includes(search.toLowerCase())),
  );
  const technicians = users.filter((u) => u.active);

  return (
    <>
      <PageHeader title="Ordens de Serviço" subtitle={`${orders.filter((o) => !["Concluída", "Cancelada"].includes(o.status)).length} em aberto`}>
        <input className="input w-full sm:w-56" placeholder="Buscar nº, cliente, serviço" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input min-w-0 flex-1 sm:w-44 sm:flex-none" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
          <option value="">Todos os técnicos</option>
          {technicians.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="flex rounded-xl border border-border bg-card p-1">
          <button className={clsx("rounded-lg p-1.5", view === "kanban" && "bg-muted")} onClick={() => setView("kanban")} title="Quadro"><LayoutGrid className="h-4 w-4" /></button>
          <button className={clsx("rounded-lg p-1.5", view === "list" && "bg-muted")} onClick={() => setView("list")} title="Lista"><List className="h-4 w-4" /></button>
        </div>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" /> Nova OS</button>
      </PageHeader>

      <ErrorBox message={error} />
      {loading ? <Loading /> : orders.length === 0 ? <div className="card"><Empty icon={ClipboardList} text="Nenhuma ordem de serviço." /></div> : view === "kanban" ? (
        <>
        {/* Celular: abas de status em vez de colunas lado a lado */}
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:hidden [scrollbar-width:none]">
          {OS_STATUS.map((col) => {
            const count = filtered.filter((o) => o.status === col.id).length;
            const active = mobileCol === col.id;
            return (
              <button key={col.id} onClick={() => setMobileCol(col.id)}
                className={clsx("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  active ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground")}>
                {col.id}
                <span className={clsx("rounded-full px-1.5 text-xs", active ? "bg-primary text-white" : "bg-muted")}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 pb-4 sm:overflow-x-auto">
          {OS_STATUS.map((col) => {
            const list = filtered.filter((o) => o.status === col.id);
            return (
              <div key={col.id} className={clsx("w-full sm:block sm:w-72 sm:shrink-0", mobileCol !== col.id && "hidden")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const o = orders.find((x) => x.id === e.dataTransfer.getData("id"));
                  if (o) changeStatus(o, col.id);
                }}>
                <div className="mb-3 hidden items-center justify-between px-1 sm:flex">
                  <StatusBadge status={col.id} list={OS_STATUS} />
                  <span className="text-sm text-muted-foreground">{list.length}</span>
                </div>
                <div className="min-h-32 space-y-3 rounded-2xl bg-muted/40 p-2">
                  {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground sm:hidden">Nenhuma OS com status “{col.id}”.</p>}
                  {list.map((o) => (
                    <div key={o.id} draggable onDragStart={(e) => e.dataTransfer.setData("id", o.id)} onClick={() => openOrder(o)}
                      className="card cursor-pointer p-3 transition hover:border-primary/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-muted-foreground">OS #{o.number}</span>
                        <Badge className={PRIORITY_COLOR[o.priority]}>{o.priority}</Badge>
                      </div>
                      <p className="mt-1 font-semibold">{o.client?.name}</p>
                      <p className="text-sm text-muted-foreground">{o.service_type}</p>
                      {o.scheduled_date && <p className="mt-1 text-xs text-primary">{dateTime(o.scheduled_date)}</p>}
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{o.technician?.name ?? "Sem técnico"}</span>
                        <span className="font-semibold text-foreground">{brl(o.total)}</span>
                      </div>
                      <select className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1 text-xs lg:hidden" value={o.status}
                        onClick={(e) => e.stopPropagation()} onChange={(e) => changeStatus(o, e.target.value)}>
                        {OS_STATUS.map((s) => <option key={s.id}>{s.id}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Nº</th><th>Cliente</th><th>Serviço</th><th>Técnico</th><th>Agendada</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="cursor-pointer" onClick={() => openOrder(o)}>
                  <td className="font-semibold">#{o.number}</td><td>{o.client?.name}</td><td>{o.service_type}</td>
                  <td className="text-muted-foreground">{o.technician?.name ?? "—"}</td><td className="text-muted-foreground">{dateTime(o.scheduled_date)}</td>
                  <td><StatusBadge status={o.status} list={OS_STATUS} /></td><td className="text-right font-semibold">{brl(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && <OSModal form={form} setForm={setForm} clients={clients} users={technicians} products={products}
        onSaved={() => { setForm(null); reload(); }} />}

      {notify && (() => {
        const link = whatsappLink(notify.os.client.phone,
          `Olá ${notify.os.client.name}! Sobre a OS #${notify.os.number} (${notify.os.service_type}): ${WHATS[notify.status]}.`);
        return (
          <Modal title="Avisar o cliente?" onClose={() => setNotify(null)} size="md"
            footer={<><button className="btn-ghost" onClick={() => setNotify(null)}>Agora não</button>
              {link && <a href={link} target="_blank" className="btn-primary" onClick={() => setNotify(null)}><MessageCircle className="h-4 w-4" /> Enviar no WhatsApp</a>}</>}>
            <p className="text-sm">A OS #{notify.os.number} mudou para <b>{notify.status}</b>. Deseja avisar {notify.os.client.name} pelo WhatsApp?</p>
          </Modal>
        );
      })()}
    </>
  );
}

function OSModal({ form, setForm, clients, users, products, onSaved }: {
  form: OSForm;
  setForm: React.Dispatch<React.SetStateAction<OSForm | null>>;
  clients: any[];
  users: any[];
  products: Product[];
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"dados" | "tecnico" | "itens">("dados");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: installations = [] } = useApi<any[]>(form.client_id ? `/installations?client_id=${form.client_id}` : null, []);
  const set = (patch: Partial<OSForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const bind = (k: keyof OSForm) => ({
    value: (form[k] ?? "") as any,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set({ [k]: e.target.value } as any),
  });

  function selectClient(id: string) {
    const c = clients.find((x) => x.id === id);
    const address = c ? [c.address, c.number, c.neighborhood, c.city].filter(Boolean).join(", ") : "";
    set({ client_id: id, installation_id: null, service_address: form.service_address || address });
  }

  function selectType(t: string) {
    const untouched = form.checklist.every((c) => !c.ok);
    set({ service_type: t, ...(untouched ? { checklist: (CHECKLISTS[t] || []).map((item) => ({ item, ok: false })) } : {}) });
  }

  async function save() {
    const p: string[] = [];
    if (!form.client_id) p.push("Selecione o cliente (aba Dados).");
    form.items.forEach((it, i) => {
      if (!it.description?.trim()) p.push(`Item ${i + 1}: preencha a descrição.`);
      if (!(Number(it.quantity) > 0)) p.push(`Item ${i + 1}: a quantidade deve ser maior que zero.`);
      // O item "Desconto" criado na aprovação do orçamento é negativo de propósito
      if (Number(it.unit_price) < 0 && it.description !== "Desconto") p.push(`Item ${i + 1}: o preço não pode ser negativo.`);
    });
    if (!(form.warranty_days >= 0)) p.push("A garantia não pode ser negativa.");
    if (p.length) {
      setError(p.length === 1 ? p[0] : `Confira antes de salvar: ${p.join(" · ")}`);
      if (!form.client_id) setTab("dados");
      return focusFirstInvalid();
    }
    setSaving(true);
    setError("");
    try {
      const { id, number, ...body } = form;
      await api(id ? `/orders/${id}` : "/orders", {
        method: id ? "PUT" : "POST",
        json: { ...body, scheduled_date: form.scheduled_date || null, installation_id: form.installation_id || null, technician_id: form.technician_id || null },
      });
      toast.success(id ? `OS #${number} atualizada` : "Ordem de serviço criada");
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!form.id) return;
    if (!(await confirmDialog({ title: `Excluir a OS #${form.number}?`, message: "Essa ação não pode ser desfeita.", danger: true, confirmText: "Excluir" }))) return;
    try {
      await api(`/orders/${form.id}`, { method: "DELETE" });
      toast.success(`OS #${form.number} excluída`);
      onSaved();
    } catch (e) {
      toast.error(e, "Não foi possível excluir");
    }
  }

  const tabs = [{ id: "dados", label: "Dados" }, { id: "tecnico", label: "Técnico / Checklist" }, { id: "itens", label: `Itens (${form.items.length})` }] as const;

  return (
    <Modal title={form.id ? `OS #${form.number}` : "Nova ordem de serviço"} onClose={() => setForm(null)} size="xl"
      footer={<>
        {form.id && can("excluir") && <button className="btn-danger mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /></button>}
        {form.id && <Link href={`/imprimir/os/${form.id}`} target="_blank" className="btn-ghost"><Printer className="h-4 w-4" /> Imprimir</Link>}
        <span className="self-center px-2 text-sm">Total: <b>{brl(itemsTotal(form.items))}</b></span>
        <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</button>
      </>}>
      <ErrorBox message={error} />
      <div className="mb-5 flex gap-1 rounded-xl bg-muted p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx("flex-1 rounded-lg px-3 py-2 text-sm font-semibold", tab === t.id ? "bg-card shadow" : "text-muted-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dados" && (
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Cliente" className="sm:col-span-3" required error={error && !form.client_id ? "Selecione o cliente." : null}>
            <select className="input" value={form.client_id} onChange={(e) => selectClient(e.target.value)}>
              <option value="">Selecione...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Instalação" className="sm:col-span-3">
            <select className="input" value={form.installation_id ?? ""} disabled={!form.client_id}
              onChange={(e) => {
                const inst = installations.find((i) => i.id === e.target.value);
                set({ installation_id: e.target.value || null, ...(inst?.address ? { service_address: inst.address } : {}) });
              }}>
              <option value="">—</option>
              {installations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo de serviço" className="sm:col-span-2">
            <select className="input" value={form.service_type} onChange={(e) => selectType(e.target.value)}>
              {SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Prioridade" className="sm:col-span-2"><select className="input" {...bind("priority")}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Status" className="sm:col-span-2"><select className="input" {...bind("status")}>{OS_STATUS.map((s) => <option key={s.id}>{s.id}</option>)}</select></Field>
          <Field label="Técnico responsável" className="sm:col-span-3">
            <select className="input" value={form.technician_id ?? ""} onChange={(e) => set({ technician_id: e.target.value || null })}>
              <option value="">—</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Data / hora agendada" className="sm:col-span-3"><input className="input" type="datetime-local" {...bind("scheduled_date")} /></Field>
          <Field label="Endereço do serviço" className="sm:col-span-6"><input className="input" {...bind("service_address")} /></Field>
          <Field label="Solicitação / defeito relatado" className="sm:col-span-6"><textarea className="input" rows={3} {...bind("problem")} /></Field>
        </div>
      )}

      {tab === "tecnico" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Diagnóstico técnico"><textarea className="input" rows={3} {...bind("diagnosis")} /></Field>
            <Field label="Serviço executado"><textarea className="input" rows={3} {...bind("solution")} /></Field>
          </div>

          <section>
            <p className="label">Checklist</p>
            <div className="space-y-1.5">
              {form.checklist.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                  <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={c.ok}
                    onChange={(e) => set({ checklist: form.checklist.map((x, i) => (i === idx ? { ...x, ok: e.target.checked } : x)) })} />
                  <input className="flex-1 bg-transparent text-sm outline-none" value={c.item}
                    onChange={(e) => set({ checklist: form.checklist.map((x, i) => (i === idx ? { ...x, item: e.target.value } : x)) })} />
                  <button className="text-muted-foreground hover:text-red-500" onClick={() => set({ checklist: form.checklist.filter((_, i) => i !== idx) })}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button className="text-sm font-semibold text-primary" onClick={() => set({ checklist: [...form.checklist, { item: "", ok: false }] })}>+ Adicionar item</button>
            </div>
          </section>

          <section>
            <p className="label">Medições</p>
            <div className="grid gap-3 sm:grid-cols-4">
              {MEASUREMENT_FIELDS.map((m) => (
                <Field key={m} label={m}>
                  <input className="input" value={form.measurements[m] ?? ""} onChange={(e) => set({ measurements: { ...form.measurements, [m]: e.target.value } })} />
                </Field>
              ))}
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Garantia do serviço (dias)"><input className="input" type="number" value={form.warranty_days} onChange={(e) => set({ warranty_days: Number(e.target.value) })} /></Field>
            <Field label="Nº ART / TRT"><input className="input" {...bind("art_number")} /></Field>
          </div>
        </div>
      )}

      {tab === "itens" && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">Materiais do catálogo saem do estoque automaticamente quando a OS é concluída.</p>
          <ItemsEditor items={form.items} onChange={(items) => set({ items })} products={products} />
        </div>
      )}
    </Modal>
  );
}

export default function OSPage() {
  return <Suspense fallback={<Loading />}><OSContent /></Suspense>;
}
