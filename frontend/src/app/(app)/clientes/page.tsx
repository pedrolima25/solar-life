"use client";

import { Eye, MessageCircle, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Empty, ErrorBox, Field, Loading, Modal, PageHeader, StatusBadge, useFormBinder } from "@/components/ui";
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
  const bind = useFormBinder(form ?? {}, setForm);

  async function lookupCep() {
    const cep = (form.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json());
      if (!r.erro) setForm((f: any) => ({ ...f, address: r.logradouro, neighborhood: r.bairro, city: r.localidade, state: r.uf }));
    } catch { /* sem internet: preenche manualmente */ }
  }

  async function save() {
    setSaving(true);
    setFormError("");
    try {
      const { id, created_at, ...body } = form;
      await api(id ? `/clients/${id}` : "/clients", { method: id ? "PUT" : "POST", json: body });
      setForm(null);
      reload();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: any) {
    if (!confirm(`Excluir o cliente ${c.name}?`)) return;
    try {
      await api(`/clients/${c.id}`, { method: "DELETE" });
      reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${clients.length} cadastrado(s)`}>
        {can("editarClientes") && <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" /> Novo cliente</button>}
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
                        {can("editarClientes") && <button className="rounded-lg p-2 hover:bg-muted" title="Editar" onClick={() => setForm({ ...c })}><Pencil className="h-4 w-4" /></button>}
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
          footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" disabled={saving || !form.name} onClick={save}>Salvar</button></>}>
          <ErrorBox message={formError} />
          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Nome / Razão social" className="sm:col-span-4"><input className="input" {...bind("name")} /></Field>
            <Field label="Tipo" className="sm:col-span-2">
              <select className="input" {...bind("person_type")}><option value="PF">Pessoa Física</option><option value="PJ">Pessoa Jurídica</option></select>
            </Field>
            <Field label={form.person_type === "PJ" ? "CNPJ" : "CPF"} className="sm:col-span-2"><input className="input" {...bind("document")} /></Field>
            <Field label="Telefone / WhatsApp" className="sm:col-span-2"><input className="input" {...bind("phone")} /></Field>
            <Field label="E-mail" className="sm:col-span-2"><input className="input" type="email" {...bind("email")} /></Field>
            <Field label="CEP" className="sm:col-span-2"><input className="input" {...bind("cep")} onBlur={lookupCep} /></Field>
            <Field label="Endereço" className="sm:col-span-3"><input className="input" {...bind("address")} /></Field>
            <Field label="Número" className="sm:col-span-1"><input className="input" {...bind("number")} /></Field>
            <Field label="Bairro" className="sm:col-span-2"><input className="input" {...bind("neighborhood")} /></Field>
            <Field label="Cidade" className="sm:col-span-3"><input className="input" {...bind("city")} /></Field>
            <Field label="UF" className="sm:col-span-1"><input className="input" maxLength={2} {...bind("state")} /></Field>
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
