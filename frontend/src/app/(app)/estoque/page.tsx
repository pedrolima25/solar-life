"use client";

import { ArrowDownUp, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { confirmDialog, focusFirstInvalid, toast } from "@/components/feedback";
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, useFormBinder } from "@/components/ui";
import { hasErrors, rules, validate } from "@/lib/validation";
import { api } from "@/lib/api";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { brl, num } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/hooks";

const EMPTY = { name: "", category: "Material Elétrico", brand: "", unit: "un", cost_price: 0, sale_price: 0, stock: 0, min_stock: 0, is_service: false };
const SERVICE_CATS = ["Mão de Obra", "Serviço", "Projeto", "Visita Técnica"];

export default function EstoquePage() {
  const { data: products = [], loading, error, reload } = useApi<any[]>("/products", []);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [form, setForm] = useState<any>(null);
  const [move, setMove] = useState<{ p: any; qty: number; kind: "in" | "out" } | null>(null);
  const [formError, setFormError] = useState("");
  const bind = useFormBinder(form ?? {}, setForm);

  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (!form) { setErrors({}); setFormError(""); } }, [form]);

  async function save() {
    const e = validate(form, {
      name: [rules.required("Nome")],
      unit: [rules.required("Unidade")],
      cost_price: [rules.min(0, "Preço de custo")],
      sale_price: [rules.min(0, "Preço de venda")],
      min_stock: [rules.min(0, "Estoque mínimo")],
    }) as Record<string, string>;
    setErrors(e);
    if (hasErrors(e)) return focusFirstInvalid();
    if (form.sale_price > 0 && form.cost_price > form.sale_price) {
      const ok = await confirmDialog({
        title: "Preço de venda menor que o custo",
        message: `Custo ${brl(form.cost_price)} e venda ${brl(form.sale_price)}: esse item dá prejuízo. Salvar mesmo assim?`,
        confirmText: "Salvar assim",
      });
      if (!ok) return;
    }
    setFormError("");
    try {
      const { id, ...body } = form;
      await api(id ? `/products/${id}` : "/products", { method: id ? "PUT" : "POST", json: body });
      toast.success(id ? "Item atualizado" : "Item cadastrado", form.name);
      setForm(null);
      reload();
    } catch (e: any) {
      setFormError(e.message);
    }
  }

  async function doMove() {
    if (!move) return;
    if (!(move.qty > 0)) return toast.warning("Informe a quantidade", "A quantidade deve ser maior que zero.");
    if (move.kind === "out" && move.qty > move.p.stock) {
      const ok = await confirmDialog({
        title: "Saída maior que o estoque",
        message: `Saldo atual: ${num(move.p.stock, 2)} ${move.p.unit}. O estoque ficará negativo. Continuar?`,
        confirmText: "Registrar saída",
      });
      if (!ok) return;
    }
    try {
      await api(`/products/${move.p.id}/move`, { method: "POST", json: { quantity: move.kind === "in" ? move.qty : -move.qty } });
      toast.success(move.kind === "in" ? "Entrada registrada" : "Saída registrada", `${num(move.qty, 2)} ${move.p.unit} · ${move.p.name}`);
      setMove(null);
      reload();
    } catch (e) {
      toast.error(e, "Não foi possível movimentar o estoque");
    }
  }

  async function remove(p: any) {
    if (!(await confirmDialog({ title: `Excluir "${p.name}"?`, message: "Essa ação não pode ser desfeita.", danger: true, confirmText: "Excluir" }))) return;
    try {
      await api(`/products/${p.id}`, { method: "DELETE" });
      toast.success("Item excluído", p.name);
      reload();
    } catch (e) {
      toast.error(e, "Não foi possível excluir");
    }
  }

  const filtered = products.filter((p) => (!cat || p.category === cat) && (!search || p.name.toLowerCase().includes(search.toLowerCase())));
  const materials = products.filter((p) => !p.is_service);
  const value = materials.reduce((s, p) => s + Math.max(p.stock, 0) * p.cost_price, 0);
  const low = materials.filter((p) => p.min_stock > 0 && p.stock <= p.min_stock).length;

  return (
    <>
      <PageHeader title="Materiais / Estoque" subtitle="Módulos, inversores, materiais elétricos e serviços">
        {can("editarCatalogo") && <button className="btn-primary" onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" /> Novo item</button>}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Itens cadastrados" value={products.length} icon={Package} />
        <StatCard label="Valor em estoque (custo)" value={brl(value)} icon={Package} tone="emerald" />
        <StatCard label="Abaixo do mínimo" value={low} icon={Package} tone={low ? "red" : "sky"} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Buscar item" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-52" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          {PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <ErrorBox message={error} />
      <div className="card overflow-x-auto">
        {loading ? <Loading /> : filtered.length === 0 ? <Empty icon={Package} text="Nenhum item." /> : (
          <table className="table-base">
            <thead><tr><th>Item</th><th>Categoria</th><th className="text-right">Custo</th><th className="text-right">Venda</th><th className="text-right">Estoque</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {filtered.map((p) => {
                const isLow = !p.is_service && p.min_stock > 0 && p.stock <= p.min_stock;
                return (
                  <tr key={p.id}>
                    <td><p className="font-medium">{p.name}</p>{p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}</td>
                    <td className="text-muted-foreground">{p.category}</td>
                    <td className="text-right text-muted-foreground">{brl(p.cost_price)}</td>
                    <td className="text-right font-semibold">{brl(p.sale_price)}<span className="text-xs font-normal text-muted-foreground">/{p.unit}</span></td>
                    <td className="text-right">
                      {p.is_service ? <Badge className="border-border text-muted-foreground">Serviço</Badge> : (
                        <span className={isLow ? "font-bold text-red-500" : "font-semibold"}>{num(p.stock, p.stock % 1 ? 2 : 0)} {p.unit}</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {!p.is_service && can("movimentarEstoque") && <button className="rounded-lg p-2 hover:bg-muted" title="Entrada / saída" onClick={() => setMove({ p, qty: 1, kind: "in" })}><ArrowDownUp className="h-4 w-4" /></button>}
                        {can("editarCatalogo") && <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setForm({ ...p })}><Pencil className="h-4 w-4" /></button>}
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
        <Modal title={form.id ? "Editar item" : "Novo item"} onClose={() => setForm(null)}
          footer={<><button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
          <ErrorBox message={formError} />
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Nome" className="sm:col-span-4" required error={errors.name}><input className="input" autoFocus {...bind("name")} /></Field>
            <Field label="Categoria" className="sm:col-span-2">
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, is_service: SERVICE_CATS.includes(e.target.value) })}>
                {PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Marca"><input className="input" {...bind("brand")} /></Field>
            <Field label="Unidade" required error={errors.unit}><input className="input" placeholder="un, m, kit, h, kWp" {...bind("unit")} /></Field>
            <Field label="Preço de custo" error={errors.cost_price}><input className="input" type="number" min={0} step="0.01" {...bind("cost_price", "number")} /></Field>
            <Field label="Preço de venda" error={errors.sale_price}
              hint={form.cost_price > 0 && form.sale_price > 0 ? `Margem: ${num(((form.sale_price - form.cost_price) / form.sale_price) * 100, 1)}%` : undefined}>
              <input className="input" type="number" min={0} step="0.01" {...bind("sale_price", "number")} />
            </Field>
            {!form.is_service && (
              <>
                <Field label="Estoque atual" error={errors.stock}><input className="input" type="number" min={0} step="any" {...bind("stock", "number")} /></Field>
                <Field label="Estoque mínimo" error={errors.min_stock}><input className="input" type="number" min={0} step="any" {...bind("min_stock", "number")} /></Field>
              </>
            )}
            <label className="flex items-center gap-2 text-sm sm:col-span-4">
              <input type="checkbox" checked={form.is_service} onChange={(e) => setForm({ ...form, is_service: e.target.checked })} /> É serviço / mão de obra (não controla estoque)
            </label>
          </div>
        </Modal>
      )}

      {move && (
        <Modal title={`Movimentar: ${move.p.name}`} onClose={() => setMove(null)} size="md"
          footer={<><button className="btn-ghost" onClick={() => setMove(null)}>Cancelar</button><button className="btn-primary" disabled={!move.qty} onClick={doMove}>Confirmar</button></>}>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["in", "out"] as const).map((k) => (
                <button key={k} onClick={() => setMove({ ...move, kind: k })}
                  className={`btn flex-1 border ${move.kind === k ? (k === "in" ? "border-emerald-500 bg-emerald-500/15 text-emerald-500" : "border-red-500 bg-red-500/15 text-red-500") : "border-border"}`}>
                  {k === "in" ? "Entrada" : "Saída"}
                </button>
              ))}
            </div>
            <Field label={`Quantidade (${move.p.unit})`}><input className="input" type="number" min={0} step="any" value={move.qty} onChange={(e) => setMove({ ...move, qty: Number(e.target.value) })} /></Field>
            <p className="text-sm text-muted-foreground">Saldo atual: {num(move.p.stock, 2)} → <b>{num(move.p.stock + (move.kind === "in" ? move.qty : -move.qty), 2)}</b></p>
          </div>
        </Modal>
      )}
    </>
  );
}
