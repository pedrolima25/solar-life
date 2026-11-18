"use client";

import { Pencil, Plus, RefreshCw, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, useFormBinder } from "@/components/ui";
import { api } from "@/lib/api";
import { SERVICE_TYPES } from "@/lib/constants";
import { brl, date, parseDate, todayISO } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/hooks";

const EMPTY = {
  client_id: "", installation_id: null, title: "Limpeza de módulos e inspeção", service_type: "Manutenção Preventiva",
  frequency_months: 6, value: 0, next_date: todayISO(), active: true, notes: "",
};

export default function ManutencaoPage() {
  const { data: plans = [], loading, error, reload } = useApi<any[]>("/plans", []);
  const { data: clients = [] } = useApi<any[]>("/clients", []);
  const [form, setForm] = useState<any>(null);
  const [formError, setFormError] = useState("");
  const [generated, setGenerated] = useState<any>(null);
  const bind = useFormBinder(form ?? {}, setForm);
  const { data: installations = [] } = useApi<any[]>(form?.client_id ? `/installations?client_id=${form.client_id}` : null, []);

  async function save() {
    setFormError("");
    try {
      const { id, client, installation, last_date, ...body } = form;
      await api(id ? `/plans/${id}` : "/plans", { method: id ? "PUT" : "POST", json: { ...body, installation_id: body.installation_id || null } });
      setForm(null);
      reload();
    } catch (e: any) {
      setFormError(e.message);
    }
  }

  async function generate(p: any) {
    try {
      const os = await api(`/plans/${p.id}/generate-os`, { method: "POST" });
      setGenerated(os);
      reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function remove(p: any) {
    if (!confirm(`Excluir o plano "${p.title}"?`)) return;
    await api(`/plans/${p.id}`, { method: "DELETE" });
    reload();
  }

  const today = parseDate(todayISO())!;
  const monthly = plans.filter((p) => p.active).reduce((s, p) => s + (p.value || 0) / (p.frequency_months || 1), 0);

  return (
    <>
      <PageHeader title="Planos de Manutenção" subtitle={`Receita recorrente estimada: ${brl(monthly)}/mês`}>
        {can("editarPlanos") && <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" /> Novo plano</button>}
      </PageHeader>

      {generated && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
          <span>OS #{generated.number} gerada e agendada para {date(generated.scheduled_date?.slice(0, 10))}.</span>
          <Link href={`/os?abrir=${generated.id}`} className="font-semibold underline">Abrir OS</Link>
        </div>
      )}

      <ErrorBox message={error} />
      <div className="card overflow-x-auto">
        {loading ? <Loading /> : plans.length === 0 ? <Empty icon={RefreshCw} text="Nenhum plano de manutenção. Crie contratos de limpeza e preventiva recorrentes." /> : (
          <table className="table-base">
            <thead><tr><th>Plano</th><th>Cliente</th><th>Frequência</th><th>Última</th><th>Próxima</th><th className="text-right">Valor</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {plans.map((p) => {
                const next = parseDate(p.next_date);
                const late = p.active && next && next < today;
                const soon = p.active && next && !late && next.getTime() - today.getTime() <= 15 * 86400000;
                return (
                  <tr key={p.id} className={!p.active ? "opacity-50" : ""}>
                    <td><p className="font-medium">{p.title}</p><p className="text-xs text-muted-foreground">{p.service_type}{p.installation ? ` · ${p.installation.name}` : ""}</p></td>
                    <td>{p.client?.name}</td>
                    <td className="text-muted-foreground">A cada {p.frequency_months} {p.frequency_months === 1 ? "mês" : "meses"}</td>
                    <td className="text-muted-foreground">{date(p.last_date)}</td>
                    <td>
                      <span className={late ? "font-semibold text-red-500" : soon ? "font-semibold text-amber-500" : ""}>{date(p.next_date)}</span>
                      {late && <Badge className="ml-2 border-red-500/30 bg-red-500/10 text-red-500">Atrasada</Badge>}
                      {!p.active && <Badge className="ml-2 border-border text-muted-foreground">Inativo</Badge>}
                    </td>
                    <td className="text-right font-semibold">{brl(p.value)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {p.active && can("editarPlanos") && <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => generate(p)}><Wrench className="h-3.5 w-3.5" /> Gerar OS</button>}
                        {can("editarPlanos") && <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setForm({ ...p })}><Pencil className="h-4 w-4" /></button>}
                        {can("excluir") && <button className="rounded-lg p-2 text-red-500 hover:bg-muted" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></button>}
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
        <Modal title={form.id ? "Editar plano" : "Novo plano de manutenção"} onClose={() => setForm(null)}
          footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-primary" disabled={!form.client_id || !form.title} onClick={save}>Salvar</button></>}>
          <ErrorBox message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value, installation_id: null })}>
                <option value="">Selecione...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Instalação">
              <select className="input" value={form.installation_id ?? ""} onChange={(e) => setForm({ ...form, installation_id: e.target.value || null })}>
                <option value="">—</option>
                {installations.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <Field label="Título" className="sm:col-span-2"><input className="input" {...bind("title")} /></Field>
            <Field label="Tipo de serviço"><select className="input" {...bind("service_type")}>{SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Frequência">
              <select className="input" {...bind("frequency_months", "number")}>
                {[1, 2, 3, 4, 6, 12].map((m) => <option key={m} value={m}>{m === 1 ? "Mensal" : m === 12 ? "Anual" : `A cada ${m} meses`}</option>)}
              </select>
            </Field>
            <Field label="Valor por visita (R$)"><input className="input" type="number" step="0.01" {...bind("value", "number")} /></Field>
            <Field label="Próxima data"><input className="input" type="date" {...bind("next_date")} /></Field>
            <Field label="Observações" className="sm:col-span-2"><textarea className="input" rows={2} {...bind("notes")} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Plano ativo</label>
          </div>
        </Modal>
      )}
    </>
  );
}
