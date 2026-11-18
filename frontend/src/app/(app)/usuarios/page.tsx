"use client";

import { Pencil, Plus, UserCog } from "lucide-react";
import { useState } from "react";
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { useApi } from "@/lib/hooks";

export default function UsuariosPage() {
  const { data: users = [], loading, error, reload } = useApi<any[]>("/users", []);
  const [form, setForm] = useState<any>(null);
  const [formError, setFormError] = useState("");

  async function save() {
    setFormError("");
    try {
      const { id, ...body } = form;
      await api(id ? `/users/${id}` : "/users", { method: id ? "PUT" : "POST", json: { ...body, password: body.password || null } });
      setForm(null);
      reload();
    } catch (e: any) {
      setFormError(e.message);
    }
  }

  return (
    <>
      <PageHeader title="Equipe" subtitle="Técnicos, vendedores e administradores">
        <button className="btn-primary" onClick={() => setForm({ name: "", email: "", phone: "", role: "tecnico", active: true, password: "" })}>
          <Plus className="h-4 w-4" /> Novo usuário
        </button>
      </PageHeader>

      <ErrorBox message={error} />
      <div className="card overflow-x-auto">
        {loading ? <Loading /> : users.length === 0 ? <Empty icon={UserCog} text="Nenhum usuário." /> : (
          <table className="table-base">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Função</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td className="text-muted-foreground">{u.email}</td>
                  <td>{u.phone || "—"}</td>
                  <td>{ROLES[u.role] ?? u.role}</td>
                  <td>{u.active ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">Ativo</Badge> : <Badge className="border-border text-muted-foreground">Inativo</Badge>}</td>
                  <td className="text-right"><button className="rounded-lg p-2 hover:bg-muted" onClick={() => setForm({ ...u, password: "" })}><Pencil className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal title={form.id ? "Editar usuário" : "Novo usuário"} onClose={() => setForm(null)} size="md"
          footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-primary" disabled={!form.name || !form.email || (!form.id && !form.password)} onClick={save}>Salvar</button></>}>
          <ErrorBox message={formError} />
          <div className="space-y-4">
            <Field label="Nome"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="E-mail (login)"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Telefone"><input className="input" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Função">
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label={form.id ? "Nova senha (deixe em branco para manter)" : "Senha"}>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Usuário ativo</label>
          </div>
        </Modal>
      )}
    </>
  );
}
