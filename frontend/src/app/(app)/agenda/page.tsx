"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { confirmDialog, focusFirstInvalid, toast } from "@/components/feedback";
import { ErrorBox, Field, Loading, Modal, PageHeader } from "@/components/ui";
import { hasErrors, rules, validate } from "@/lib/validation";
import { api } from "@/lib/api";
import { APPOINTMENT_TYPES } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/hooks";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const TYPE_COLOR: Record<string, string> = {
  "Visita Técnica": "border-l-sky-500",
  Instalação: "border-l-amber-500",
  Manutenção: "border-l-emerald-500",
  Vistoria: "border-l-violet-500",
  "Reunião Comercial": "border-l-pink-500",
};

function mondayOf(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

export default function AgendaPage() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)), [weekStart]);
  const { data: items = [], loading, error, reload } = useApi<any[]>(`/appointments?start=${iso(days[0])}&end=${iso(days[6])}`, []);
  const { data: clients = [] } = useApi<any[]>("/clients", []);
  const { data: users = [] } = useApi<any[]>("/users", []);
  const [techFilter, setTechFilter] = useState("");
  const [form, setForm] = useState<any>(null);
  const [formError, setFormError] = useState("");

  const shift = (n: number) => setWeekStart(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + n));
  const todayIso = iso(new Date());

  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (!form) { setErrors({}); setFormError(""); } }, [form]);

  async function save() {
    const e = validate(form, {
      title: [rules.required("Título")],
      start: [rules.required("Data e hora")],
      duration_min: [rules.positive("Duração")],
    });
    setErrors(e as Record<string, string>);
    if (hasErrors(e)) return focusFirstInvalid();
    setFormError("");
    try {
      const { id, client, technician, ...body } = form;
      await api(id ? `/appointments/${id}` : "/appointments", {
        method: id ? "PUT" : "POST",
        json: { ...body, client_id: body.client_id || null, technician_id: body.technician_id || null },
      });
      toast.success(id ? "Agendamento atualizado" : "Agendamento criado", form.title);
      setForm(null);
      reload();
    } catch (e: any) {
      setFormError(e.message);
    }
  }

  async function remove() {
    if (!(await confirmDialog({ title: "Excluir este agendamento?", message: form.title, danger: true, confirmText: "Excluir" }))) return;
    try {
      await api(`/appointments/${form.id}`, { method: "DELETE" });
      toast.success("Agendamento excluído");
      setForm(null);
      reload();
    } catch (e) {
      toast.error(e, "Não foi possível excluir");
    }
  }

  const newAt = (day: Date) => setForm({
    title: "", type: "Visita Técnica", client_id: "", technician_id: "", start: `${iso(day)}T08:00`, duration_min: 60, status: "Agendado", notes: "",
  });

  const visible = items.filter((a) => !techFilter || a.technician_id === techFilter);
  const label = `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <>
      <PageHeader title="Agenda" subtitle="Visitas, instalações e manutenções da equipe">
        <select className="input w-44" value={techFilter} onChange={(e) => setTechFilter(e.target.value)}>
          <option value="">Todos os técnicos</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          <button className="rounded-lg p-1.5 hover:bg-muted" onClick={() => shift(-7)}><ChevronLeft className="h-4 w-4" /></button>
          <button className="rounded-lg px-2 py-1 text-sm font-semibold hover:bg-muted" onClick={() => setWeekStart(mondayOf(new Date()))}>Hoje</button>
          <button className="rounded-lg p-1.5 hover:bg-muted" onClick={() => shift(7)}><ChevronRight className="h-4 w-4" /></button>
        </div>
        <button className="btn-primary" onClick={() => newAt(new Date())}><Plus className="h-4 w-4" /> Agendar</button>
      </PageHeader>

      <p className="mb-3 text-sm font-semibold text-muted-foreground">{label}</p>
      <ErrorBox message={error} />
      {loading ? <Loading /> : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((day, i) => {
            const list = visible.filter((a) => a.start.slice(0, 10) === iso(day));
            const isToday = iso(day) === todayIso;
            return (
              <div key={i} className={clsx("card flex min-h-16 flex-col p-2 sm:min-h-40", isToday && "border-primary")}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className={clsx("text-sm font-semibold", isToday && "text-primary")}>{DAYS[i]} {day.getDate()}</span>
                  <button className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-primary" onClick={() => newAt(day)} title="Agendar neste dia"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="space-y-1.5">
                  {list.map((a) => (
                    <button key={a.id} onClick={() => setForm({ ...a, start: a.start.slice(0, 16), client_id: a.client_id ?? "", technician_id: a.technician_id ?? "" })}
                      className={clsx("w-full rounded-lg border-l-4 bg-muted/60 p-2 text-left text-xs hover:bg-muted", TYPE_COLOR[a.type] ?? "border-l-zinc-500",
                        a.status === "Cancelado" && "line-through opacity-50", a.status === "Concluído" && "opacity-60")}>
                      <p className="font-bold">{a.start.slice(11, 16)} · {a.title}</p>
                      {a.client && <p className="truncate text-muted-foreground">{a.client.name}</p>}
                      {a.technician && <p className="truncate text-muted-foreground">Téc.: {a.technician.name}</p>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar agendamento" : "Novo agendamento"} onClose={() => setForm(null)}
          footer={<>
            {form.id && can("excluirAgenda") && <button className="btn-danger mr-auto" onClick={remove}><Trash2 className="h-4 w-4" /></button>}
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button>
          </>}>
          <ErrorBox message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2" required error={errors.title}><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Tipo"><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{APPOINTMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["Agendado", "Concluído", "Cancelado"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Data e hora" required error={errors.start}><input className="input" type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
            <Field label="Duração (min)" error={errors.duration_min}><input className="input" type="number" min={15} step={15} value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} /></Field>
            <Field label="Cliente">
              <select className="input" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                <option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Técnico">
              <select className="input" value={form.technician_id} onChange={(e) => setForm({ ...form, technician_id: e.target.value })}>
                <option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
            <Field label="Observações" className="sm:col-span-2"><textarea className="input" rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}
