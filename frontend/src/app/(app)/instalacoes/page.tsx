"use client";

import { Pencil, Plus, SolarPanel, Trash2, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { confirmDialog, focusFirstInvalid, toast } from "@/components/feedback";
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, useFormBinder } from "@/components/ui";
import { hasErrors, rules, validate } from "@/lib/validation";
import { api } from "@/lib/api";
import { INSTALLATION_STATUS, INSTALLATION_TYPES, LIGACOES } from "@/lib/constants";
import { date, num } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/hooks";

const EMPTY = {
  client_id: "", name: "", type: "Solar On-Grid", status: "Ativa", address: "", concessionaria: "",
  unidade_consumidora: "", tipo_ligacao: "Bifásico", tensao: "127/220V", potencia_kwp: null, num_modulos: null,
  modulo_modelo: "", inversor_modelo: "", potencia_inversor_kw: null, geracao_estimada_kwh: null, estrutura: "", banco_baterias: "", autonomia: "",
  disjuntor_geral: "", description: "", installation_date: null, warranty_until: null,
};

function InstalacoesContent() {
  const params = useSearchParams();
  const [clientFilter, setClientFilter] = useState(params.get("cliente") ?? "");
  const { data: items = [], loading, error, reload } = useApi<any[]>(`/installations${clientFilter ? `?client_id=${clientFilter}` : ""}`, []);
  const { data: clients = [] } = useApi<any[]>("/clients", []);
  const [form, setForm] = useState<any>(null);
  const [formError, setFormError] = useState("");
  const bind = useFormBinder(form ?? {}, setForm);
  const isSolar = form?.type?.startsWith("Solar");

  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (!form) { setErrors({}); setFormError(""); } }, [form]);

  async function save() {
    const nonNeg = (label: string) => [rules.min(0, label)];
    const e = validate(form, {
      client_id: [rules.required("Cliente")],
      name: [rules.required("Identificação")],
      potencia_kwp: nonNeg("Potência"),
      num_modulos: nonNeg("Nº de módulos"),
      geracao_estimada_kwh: nonNeg("Geração"),
      potencia_inversor_kw: nonNeg("Potência do inversor"),
      warranty_until: [(v) => (v && form.installation_date && v < form.installation_date ? "A garantia não pode terminar antes da instalação." : null)],
    }) as Record<string, string>;
    setErrors(e);
    if (hasErrors(e)) return focusFirstInvalid();
    setFormError("");
    try {
      const { id, client, ...body } = form;
      for (const k of ["installation_date", "warranty_until"]) if (!body[k]) body[k] = null;
      await api(id ? `/installations/${id}` : "/installations", { method: id ? "PUT" : "POST", json: body });
      toast.success(id ? "Instalação atualizada" : "Instalação cadastrada", form.name);
      setForm(null);
      reload();
    } catch (e: any) {
      setFormError(e.message);
    }
  }

  async function remove(i: any) {
    if (!(await confirmDialog({ title: `Excluir a instalação "${i.name}"?`, message: "Essa ação não pode ser desfeita.", danger: true, confirmText: "Excluir" }))) return;
    try {
      await api(`/installations/${i.id}`, { method: "DELETE" });
      toast.success("Instalação excluída", i.name);
      reload();
    } catch (e) {
      toast.error(e, "Não foi possível excluir");
    }
  }

  const totalKwp = items.reduce((s, i) => s + (i.potencia_kwp || 0), 0);

  return (
    <>
      <PageHeader title="Instalações / Usinas" subtitle={`${items.length} instalação(ões) · ${num(totalKwp, 2)} kWp`}>
        <select className="input w-56" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="">Todos os clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY, client_id: clientFilter })}><Plus className="h-4 w-4" /> Nova instalação</button>
      </PageHeader>

      <ErrorBox message={error} />
      {loading ? <Loading /> : items.length === 0 ? <div className="card"><Empty icon={SolarPanel} text="Nenhuma instalação cadastrada." /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((i) => {
            const solar = i.type.startsWith("Solar");
            return (
              <div key={i.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${solar ? "bg-amber-500/15 text-amber-500" : "bg-sky-500/15 text-sky-500"}`}>
                      {solar ? <SolarPanel className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-semibold">{i.name}</p>
                      <p className="text-sm text-muted-foreground">{i.client?.name}</p>
                    </div>
                  </div>
                  <Badge className={i.status === "Ativa" ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-500" : "border-amber-500/30 bg-amber-500/15 text-amber-500"}>{i.status}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Tipo</dt><dd>{i.type}</dd></div>
                  {solar ? (
                    <>
                      <div><dt className="text-xs text-muted-foreground">Potência</dt><dd>{i.potencia_kwp ? `${num(i.potencia_kwp, 2)} kWp` : "—"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Módulos</dt><dd>{i.num_modulos ?? "—"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Geração est.</dt><dd>{i.geracao_estimada_kwh ? `${num(i.geracao_estimada_kwh)} kWh/mês` : "—"}</dd></div>
                      <div className="col-span-2"><dt className="text-xs text-muted-foreground">Inversor</dt><dd className="truncate">{i.inversor_modelo || "—"}</dd></div>
                      {i.banco_baterias && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Baterias</dt><dd className="truncate">{i.banco_baterias}{i.autonomia ? ` · ${i.autonomia}` : ""}</dd></div>}
                    </>
                  ) : (
                    <>
                      <div><dt className="text-xs text-muted-foreground">Ligação</dt><dd>{i.tipo_ligacao || "—"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Disjuntor geral</dt><dd>{i.disjuntor_geral || "—"}</dd></div>
                    </>
                  )}
                  <div><dt className="text-xs text-muted-foreground">Instalado em</dt><dd>{date(i.installation_date)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Garantia até</dt><dd>{date(i.warranty_until)}</dd></div>
                </dl>
                <div className="mt-4 flex justify-end gap-1 border-t border-border pt-3">
                  <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setForm({ ...i })}><Pencil className="h-4 w-4" /></button>
                  {can("excluir") && <button className="rounded-lg p-2 text-red-500 hover:bg-muted" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar instalação" : "Nova instalação"} onClose={() => setForm(null)} size="xl"
          footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-primary" onClick={save}>Salvar</button></>}>
          <ErrorBox message={formError} />
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Cliente" className="sm:col-span-3" required error={errors.client_id}>
              <select className="input" {...bind("client_id")}><option value="">Selecione...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            <Field label="Identificação" className="sm:col-span-3" required error={errors.name}><input className="input" placeholder="Ex.: Usina residencial, Quadro galpão" {...bind("name")} /></Field>
            <Field label="Tipo" className="sm:col-span-2"><select className="input" {...bind("type")}>{INSTALLATION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Status" className="sm:col-span-2"><select className="input" {...bind("status")}>{INSTALLATION_STATUS.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Ligação" className="sm:col-span-2"><select className="input" {...bind("tipo_ligacao")}>{LIGACOES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Endereço da instalação" className="sm:col-span-6"><input className="input" {...bind("address")} /></Field>
            <Field label="Concessionária" className="sm:col-span-2"><input className="input" {...bind("concessionaria")} /></Field>
            <Field label="Unidade consumidora (UC)" className="sm:col-span-2"><input className="input" {...bind("unidade_consumidora")} /></Field>
            <Field label="Tensão" className="sm:col-span-2"><input className="input" {...bind("tensao")} /></Field>

            {isSolar && (
              <>
                <p className="label sm:col-span-6 mt-2 text-primary">Sistema fotovoltaico</p>
                <Field label="Potência (kWp)" className="sm:col-span-2" error={errors.potencia_kwp}><input className="input" type="number" step="0.01" {...bind("potencia_kwp", "number")} /></Field>
                <Field label="Nº de módulos" className="sm:col-span-2" error={errors.num_modulos}><input className="input" type="number" {...bind("num_modulos", "number")} /></Field>
                <Field label="Geração estimada (kWh/mês)" className="sm:col-span-2" error={errors.geracao_estimada_kwh}><input className="input" type="number" {...bind("geracao_estimada_kwh", "number")} /></Field>
                <Field label="Modelo dos módulos" className="sm:col-span-3"><input className="input" {...bind("modulo_modelo")} /></Field>
                <Field label="Modelo do inversor" className="sm:col-span-3"><input className="input" {...bind("inversor_modelo")} /></Field>
                <Field label="Potência do inversor (kW)" className="sm:col-span-2" error={errors.potencia_inversor_kw}><input className="input" type="number" step="0.1" {...bind("potencia_inversor_kw", "number")} /></Field>
                <Field label="Estrutura" className="sm:col-span-4"><input className="input" placeholder="Telhado cerâmico, metálico, laje, solo..." {...bind("estrutura")} /></Field>
                {form.type !== "Solar On-Grid" && (
                  <>
                    <Field label="Banco de baterias" className="sm:col-span-4"><input className="input" placeholder="Ex.: 4 × Lítio 48 V 5,12 kWh (20,5 kWh)" {...bind("banco_baterias")} /></Field>
                    <Field label="Autonomia / reserva" className="sm:col-span-2"><input className="input" placeholder="Ex.: 1,5 dia / 4 h" {...bind("autonomia")} /></Field>
                  </>
                )}
              </>
            )}
            <Field label="Disjuntor geral" className="sm:col-span-2"><input className="input" {...bind("disjuntor_geral")} /></Field>
            <Field label="Data de instalação" className="sm:col-span-2"><input className="input" type="date" {...bind("installation_date")} /></Field>
            <Field label="Garantia até" className="sm:col-span-2" error={errors.warranty_until}><input className="input" type="date" {...bind("warranty_until")} /></Field>
            <Field label="Descrição / observações" className="sm:col-span-6"><textarea className="input" rows={3} {...bind("description")} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function InstalacoesPage() {
  return <Suspense fallback={<Loading />}><InstalacoesContent /></Suspense>;
}
