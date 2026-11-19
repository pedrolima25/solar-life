"use client";

import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { confirmDialog, focusFirstInvalid, toast } from "@/components/feedback";
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, StatCard } from "@/components/ui";
import { hasErrors, rules, validate } from "@/lib/validation";
import { api } from "@/lib/api";
import { FINANCE_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { brl, date, parseDate, todayISO } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/hooks";

export default function FinanceiroPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [kind, setKind] = useState("");
  const { data: entries = [], loading, error, reload } = useApi<any[]>(`/finance?month=${month}${kind ? `&kind=${kind}` : ""}`, []);
  const { data: clients = [] } = useApi<any[]>("/clients", []);
  const [form, setForm] = useState<any>(null);
  const [formError, setFormError] = useState("");

  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const rawLabel = parseDate(`${month}-01`)!.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  const sum = (f: (e: any) => boolean) => entries.filter(f).reduce((s, e) => s + e.amount, 0);
  const received = sum((e) => e.kind === "receita" && e.paid);
  const toReceive = sum((e) => e.kind === "receita" && !e.paid);
  const paid = sum((e) => e.kind === "despesa" && e.paid);
  const toPay = sum((e) => e.kind === "despesa" && !e.paid);
  const today = parseDate(todayISO())!;

  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (!form) { setErrors({}); setFormError(""); } }, [form]);

  async function save() {
    const e = validate(form, {
      description: [rules.required("Descrição")],
      amount: [rules.positive("Valor")],
      due_date: [rules.required("Vencimento")],
    }) as Record<string, string>;
    setErrors(e);
    if (hasErrors(e)) return focusFirstInvalid();
    setFormError("");
    try {
      const { id, client, os_id, quote_id, ...body } = form;
      await api(id ? `/finance/${id}` : "/finance", {
        method: id ? "PUT" : "POST",
        json: { ...body, client_id: body.client_id || null, paid_date: body.paid ? body.paid_date || todayISO() : null },
      });
      toast.success(id ? "Lançamento atualizado" : `${form.kind === "receita" ? "Receita" : "Despesa"} lançada`, `${form.description} · ${brl(form.amount)}`);
      setForm(null);
      reload();
    } catch (e: any) {
      setFormError(e.message);
    }
  }

  async function togglePaid(e: any) {
    const { id, client, os_id, quote_id, ...body } = e;
    try {
      await api(`/finance/${id}`, { method: "PUT", json: { ...body, paid: !e.paid, paid_date: !e.paid ? todayISO() : null } });
      toast.success(!e.paid ? (e.kind === "receita" ? "Marcado como recebido" : "Marcado como pago") : "Marcado como em aberto", `${e.description} · ${brl(e.amount)}`);
      reload();
    } catch (err) {
      toast.error(err, "Não foi possível atualizar");
    }
  }

  async function remove(e: any) {
    if (!(await confirmDialog({ title: `Excluir "${e.description}"?`, message: `${brl(e.amount)} · vencimento ${date(e.due_date)}. Essa ação não pode ser desfeita.`, danger: true, confirmText: "Excluir" }))) return;
    try {
      await api(`/finance/${e.id}`, { method: "DELETE" });
      toast.success("Lançamento excluído", e.description);
      reload();
    } catch (err) {
      toast.error(err, "Não foi possível excluir");
    }
  }

  const newEntry = (k: "receita" | "despesa") => setForm({
    kind: k, description: "", category: FINANCE_CATEGORIES[k][0], amount: 0, due_date: todayISO(), paid: false, payment_method: "PIX", client_id: "",
  });

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Contas a receber e a pagar">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <button className="rounded-lg p-1.5 hover:bg-muted" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></button>
          <span className="w-36 text-center text-sm font-semibold">{monthLabel}</span>
          <button className="rounded-lg p-1.5 hover:bg-muted" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
        <button className="btn-ghost text-red-500" onClick={() => newEntry("despesa")}><Plus className="h-4 w-4" /> Despesa</button>
        <button className="btn-primary" onClick={() => newEntry("receita")}><Plus className="h-4 w-4" /> Receita</button>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recebido" value={brl(received)} hint={`A receber: ${brl(toReceive)}`} icon={TrendingUp} tone="emerald" />
        <StatCard label="Pago" value={brl(paid)} hint={`A pagar: ${brl(toPay)}`} icon={TrendingDown} tone="red" />
        <StatCard label="Saldo realizado" value={brl(received - paid)} icon={Wallet} tone={received - paid >= 0 ? "emerald" : "red"} />
        <StatCard label="Saldo previsto" value={brl(received + toReceive - paid - toPay)} icon={Wallet} tone="amber" />
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1 sm:w-fit">
        {[["", "Todos"], ["receita", "Receitas"], ["despesa", "Despesas"]].map(([k, l]) => (
          <button key={k} onClick={() => setKind(k)} className={clsx("rounded-lg px-4 py-1.5 text-sm font-semibold", kind === k ? "bg-card shadow" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>

      <ErrorBox message={error} />
      <div className="card overflow-x-auto">
        {loading ? <Loading /> : entries.length === 0 ? <Empty icon={Wallet} text="Nenhum lançamento neste mês." /> : (
          <table className="table-base">
            <thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Situação</th><th className="text-right">Valor</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {entries.map((e) => {
                const late = !e.paid && parseDate(e.due_date)! < today;
                return (
                  <tr key={e.id}>
                    <td className={late ? "font-semibold text-red-500" : ""}>{date(e.due_date)}</td>
                    <td><p className="font-medium">{e.description}</p>{e.client && <p className="text-xs text-muted-foreground">{e.client.name}</p>}</td>
                    <td className="text-muted-foreground">{e.category}</td>
                    <td>
                      {e.paid ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">{e.kind === "receita" ? "Recebido" : "Pago"} {date(e.paid_date)}</Badge>
                        : late ? <Badge className="border-red-500/30 bg-red-500/10 text-red-500">Atrasado</Badge>
                        : <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-500">Pendente</Badge>}
                    </td>
                    <td className={clsx("text-right font-semibold", e.kind === "receita" ? "text-emerald-500" : "text-red-500")}>
                      {e.kind === "despesa" ? "− " : ""}{brl(e.amount)}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button className={clsx("rounded-lg p-2 hover:bg-muted", e.paid ? "text-emerald-500" : "text-muted-foreground")} title={e.paid ? "Desfazer baixa" : "Dar baixa"} onClick={() => togglePaid(e)}><Check className="h-4 w-4" /></button>
                        <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setForm({ ...e, client_id: e.client_id ?? "" })}><Pencil className="h-4 w-4" /></button>
                        {can("excluir") && <button className="rounded-lg p-2 text-red-500 hover:bg-muted" onClick={() => remove(e)}><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal title={`${form.id ? "Editar" : "Nova"} ${form.kind === "receita" ? "receita" : "despesa"}`} onClose={() => setForm(null)}
          footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button></>}>
          <ErrorBox message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Descrição" className="sm:col-span-2" required error={errors.description}><input autoFocus className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Categoria">
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {FINANCE_CATEGORIES[form.kind as "receita" | "despesa"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Valor (R$)" required error={errors.amount}><input className="input" type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
            <Field label="Vencimento" required error={errors.due_date}><input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
            <Field label="Forma de pagamento">
              <select className="input" value={form.payment_method ?? ""} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="">—</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            {form.kind === "receita" && (
              <Field label="Cliente" className="sm:col-span-2">
                <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} /> Já foi {form.kind === "receita" ? "recebido" : "pago"}</label>
          </div>
        </Modal>
      )}
    </>
  );
}
