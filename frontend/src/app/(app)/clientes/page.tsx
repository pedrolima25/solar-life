"use client";

import { Eye, MessageCircle, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { confirmDialog, focusFirstInvalid, toast } from "@/components/feedback";
import { Empty, ErrorBox, Field, Loading, Modal, PageHeader, StatusBadge, useFormBinder } from "@/components/ui";
import { digits, type Errors, hasErrors, maskCEP, maskCNPJ, maskCPF, maskPhone, rules, validate } from "@/lib/validation";
import { api } from "@/lib/api";
import { OS_STATUS, QUOTE_STATUS } from "@/lib/constants";
import { brl, date, num, whatsappLink } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/hooks";

const EMPTY = {
  name: "", person_type: "PF", document: "", phone: "", email: "", cep: "", address: "",
  number: "", neighborhood: "", city: "", state: "", notes: "",
};

export default function ClientesPage() {
  const [q, setQ] = useState("");
  const { data: clients = [], loading, error, reload } = useApi<any[]>(`/clients${q ? `?q=${encodeURIComponent(q)}` : ""}`, []);
  const [form, setForm] = useState<any>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<Errors<typeof EMPTY>>({});
  const bind = useFormBinder(form ?? {}, setForm);
  // Campo com máscara: formata enquanto digita e limpa o erro do campo
  const masked = (key: keyof typeof EMPTY, mask: (v: string) => string) => ({
    value: form?.[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f: any) => ({ ...f, [key]: mask(e.target.value) }));
      setErrors((er) => ({ ...er, [key]: undefined }));
    },
  });

  function open(c: any) {
    setErrors({});
    setFormError("");
    setForm(c);
  }

  async function lookupCep() {
    const cep = digits(form.cep);
    if (!cep) return;
    if (cep.length !== 8) return setErrors((er) => ({ ...er, cep: "CEP deve ter 8 dígitos." }));
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json());
      if (r.erro) setErrors((er) => ({ ...er, cep: "CEP não encontrado. Confira ou preencha o endereço manualmente." }));
      else setForm((f: any) => ({ ...f, address: r.logradouro || f.address, neighborhood: r.bairro || f.neighborhood, city: r.localidade, state: r.uf }));
    } catch { /* sem internet: preenche manualmente */ }
  }

  function check() {
    const e = validate(form, {
      name: [rules.required("Nome"), rules.minLength(3, "Nome")],
      document: [form.person_type === "PJ" ? rules.cnpj() : rules.cpf()],
      phone: [rules.phone()],
      email: [rules.email()],
      cep: [rules.cep()],
      state: [(v) => (v && !/^[A-Za-z]{2}$/.test(v) ? "UF com 2 letras (ex.: RR)." : null)],
    });
    setErrors(e);
    return !hasErrors(e);
  }

  async function save() {
    if (!check()) return focusFirstInvalid();
    setSaving(true);
    setFormError("");
    try {
      const { id, created_at, ...body } = form;
      await api(id ? `/clients/${id}` : "/clients", { method: id ? "PUT" : "POST", json: { ...body, state: body.state?.toUpperCase() } });
      toast.success(id ? "Cliente atualizado" : "Cliente cadastrado", form.name);
      setForm(null);
      reload();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: any) {
    const ok = await confirmDialog({
      title: `Excluir o cliente ${c.name}?`, danger: true, confirmText: "Excluir",
      message: "Essa ação não pode ser desfeita. Clientes com orçamentos ou ordens de serviço não podem ser excluídos.",
    });
    if (!ok) return;
    try {
      await api(`/clients/${c.id}`, { method: "DELETE" });
      toast.success("Cliente excluído", c.name);
      reload();
    } catch (e) {
      toast.error(e, "Não foi possível excluir");
    }
  }

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${clients.length} cadastrado(s)`}>
        {can("editarClientes") && <button className="btn-primary" onClick={() => open({ ...EMPTY })}><Plus className="h-4 w-4" /> Novo cliente</button>}
      </PageHeader>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input className="input pl-9" placeholder="Buscar por nome, CPF/CNPJ, telefone ou cidade" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <ErrorBox message={error} />
      <div className="card overflow-x-auto">
        {loading ? <Loading /> : clients.length === 0 ? <Empty icon={Users} text="Nenhum cliente encontrado." /> : (
          <table className="table-base">
            <thead><tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>Cidade</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {clients.map((c) => {
                const wa = whatsappLink(c.phone, `Olá ${c.name}!`);
                return (
                  <tr key={c.id}>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-muted-foreground">{c.document || "—"}</td>
                    <td>{c.phone || "—"}</td>
                    <td className="text-muted-foreground">{[c.city, c.state].filter(Boolean).join("/") || "—"}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {wa && <a href={wa} target="_blank" className="rounded-lg p-2 text-emerald-500 hover:bg-muted" title="WhatsApp"><MessageCircle className="h-4 w-4" /></a>}
                        <button className="rounded-lg p-2 hover:bg-muted" title="Ver" onClick={() => setDetailId(c.id)}><Eye className="h-4 w-4" /></button>
                        {can("editarClientes") && <button className="rounded-lg p-2 hover:bg-muted" title="Editar" onClick={() => open({ ...c })}><Pencil className="h-4 w-4" /></button>}
                        {can("excluir") && <button className="rounded-lg p-2 text-red-500 hover:bg-muted" title="Excluir" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></button>}
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
        <Modal title={form.id ? "Editar cliente" : "Novo cliente"} onClose={() => setForm(null)}
          footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</button></>}>
          <ErrorBox message={formError} />
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Nome / Razão social" className="sm:col-span-4" required error={errors.name}>
              <input className="input" autoFocus {...bind("name")} onInput={() => setErrors((er) => ({ ...er, name: undefined }))} />
            </Field>
            <Field label="Tipo" className="sm:col-span-2">
              <select className="input" value={form.person_type} onChange={(e) => {
                const pj = e.target.value === "PJ";
                setForm((f: any) => ({ ...f, person_type: e.target.value, document: f.document ? (pj ? maskCNPJ : maskCPF)(f.document) : "" }));
                setErrors((er) => ({ ...er, document: undefined }));
              }}><option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option></select>
            </Field>
            <Field label={form.person_type === "PJ" ? "CNPJ" : "CPF"} className="sm:col-span-2" error={errors.document}>
              <input className="input" inputMode="numeric" placeholder={form.person_type === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                {...masked("document", form.person_type === "PJ" ? maskCNPJ : maskCPF)} />
            </Field>
            <Field label="Telefone / WhatsApp" className="sm:col-span-2" error={errors.phone}>
              <input className="input" inputMode="tel" placeholder="(95) 99999-9999" {...masked("phone", maskPhone)} />
            </Field>
            <Field label="E-mail" className="sm:col-span-2" error={errors.email}>
              <input className="input" type="email" placeholder="cliente@email.com" {...bind("email")} onInput={() => setErrors((er) => ({ ...er, email: undefined }))} />
            </Field>
            <Field label="CEP" className="sm:col-span-2" error={errors.cep} hint={!errors.cep && "O endereço é preenchido sozinho"}>
              <input className="input" inputMode="numeric" placeholder="69300-000" {...masked("cep", maskCEP)} onBlur={lookupCep} />
            </Field>
            <Field label="Endereço" className="sm:col-span-3"><input className="input" {...bind("address")} /></Field>
            <Field label="Número" className="sm:col-span-1"><input className="input" {...bind("number")} /></Field>
            <Field label="Bairro" className="sm:col-span-2"><input className="input" {...bind("neighborhood")} /></Field>
            <Field label="Cidade" className="sm:col-span-3"><input className="input" {...bind("city")} /></Field>
            <Field label="UF" className="sm:col-span-1" error={errors.state}><input className="input uppercase" maxLength={2} {...bind("state")} /></Field>
            <Field label="Observações" className="sm:col-span-6"><textarea className="input" rows={3} {...bind("notes")} /></Field>
          </div>
        </Modal>
      )}

      {detailId && <ClientDetail id={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

function ClientDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = useApi<any>(`/clients/${id}`);
  return (
    <Modal title={data?.client?.name ?? "Cliente"} onClose={onClose} size="xl">
      {loading || !data ? <Loading /> : (
        <div className="space-y-6">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <p><span className="label">Telefone</span>{data.client.phone || "—"}</p>
            <p><span className="label">E-mail</span>{data.client.email || "—"}</p>
            <p><span className="label">Documento</span>{data.client.document || "—"}</p>
            <p className="sm:col-span-3"><span className="label">Endereço</span>
              {[data.client.address, data.client.number, data.client.neighborhood, data.client.city, data.client.state].filter(Boolean).join(", ") || "—"}
            </p>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Instalações</h3>
              <Link href={`/instalacoes?cliente=${id}`} className="text-sm font-semibold text-primary">Gerenciar →</Link>
            </div>
            {data.installations.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma instalação cadastrada.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.installations.map((i: any) => (
                  <li key={i.id} className="rounded-xl bg-muted/60 p-3 text-sm">
                    <p className="font-semibold">{i.name}</p>
                    <p className="text-muted-foreground">{i.type}{i.potencia_kwp ? ` · ${num(i.potencia_kwp, 2)} kWp` : ""} · {i.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-semibold">Ordens de serviço</h3>
            {data.orders.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma OS.</p> : (
              <table className="table-base">
                <tbody>
                  {data.orders.map((o: any) => (
                    <tr key={o.id}>
                      <td>OS #{o.number}</td><td>{o.service_type}</td><td>{date(o.created_at?.slice(0, 10))}</td>
                      <td><StatusBadge status={o.status} list={OS_STATUS} /></td><td className="text-right">{brl(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-semibold">Orçamentos</h3>
            {data.quotes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum orçamento.</p> : (
              <table className="table-base">
                <tbody>
                  {data.quotes.map((q: any) => (
                    <tr key={q.id}>
                      <td>#{q.number}</td><td>{q.service_type}</td><td>{date(q.created_at?.slice(0, 10))}</td>
                      <td><StatusBadge status={q.status} list={QUOTE_STATUS} /></td><td className="text-right">{brl(q.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
