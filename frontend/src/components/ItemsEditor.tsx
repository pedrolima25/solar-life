"use client";

import { Plus, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";

import { COMPONENTE_POR_CATEGORIA } from "@/lib/proposal";

export type Item = {
  product_id?: string | null; description: string; quantity: number; unit_price: number;
  component?: string | null; qty_label?: string | null;
};
export type Product = { id: string; name: string; category: string; unit: string; sale_price: number; stock: number; is_service: boolean };

export function itemsTotal(items: Item[]) {
  return Math.round(items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0) * 100) / 100;
}

export function ItemsEditor({ items, onChange, products, readOnly, proposal }: {
  items: Item[];
  onChange: (items: Item[]) => void;
  products: Product[];
  readOnly?: boolean;
  /** Mostra os campos usados na proposta impressa (componente e quantidade exibida). */
  proposal?: boolean;
}) {
  const update = (idx: number, patch: Partial<Item>) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  function pickProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return update(idx, { product_id: null });
    update(idx, { product_id: p.id, description: p.name, unit_price: p.sale_price, component: COMPONENTE_POR_CATEGORIA[p.category] ?? p.category });
  }

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-12 gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
        <span className="col-span-3">Catálogo</span><span className="col-span-4">Descrição</span>
        <span className="col-span-1">Qtd.</span><span className="col-span-2">Valor unit.</span><span className="col-span-2 text-right">Subtotal</span>
      </div>
      {items.map((it, idx) => (
        <div key={idx} className="grid grid-cols-12 items-center gap-2 rounded-xl bg-muted/40 p-2 sm:bg-transparent sm:p-0">
          <select className="input col-span-12 sm:col-span-3" disabled={readOnly} value={it.product_id ?? ""} onChange={(e) => pickProduct(idx, e.target.value)}>
            <option value="">— Item livre —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input col-span-12 sm:col-span-4" disabled={readOnly} placeholder="Descrição" value={it.description}
            onChange={(e) => update(idx, { description: e.target.value })} />
          <input className="input col-span-3 sm:col-span-1" disabled={readOnly} type="number" min={0} step="any" value={it.quantity}
            onChange={(e) => update(idx, { quantity: Number(e.target.value) })} />
          <input className="input col-span-4 sm:col-span-2" disabled={readOnly} type="number" min={0} step="0.01" value={it.unit_price}
            onChange={(e) => update(idx, { unit_price: Number(e.target.value) })} />
          <div className="col-span-5 flex items-center justify-end gap-1 sm:col-span-2">
            <span className="text-sm font-semibold">{brl((it.quantity || 0) * (it.unit_price || 0))}</span>
            {!readOnly && (
              <button type="button" className="rounded-lg p-1.5 text-red-500 hover:bg-muted" onClick={() => onChange(items.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          {proposal && (
            <>
              <input className="input col-span-7 py-1.5 text-xs sm:col-span-3" disabled={readOnly} placeholder="Componente na proposta (ex.: Inversor)"
                value={it.component ?? ""} onChange={(e) => update(idx, { component: e.target.value })} />
              <input className="input col-span-5 py-1.5 text-xs sm:col-span-2" disabled={readOnly} placeholder="Qtd. exibida (ex.: 30 + 30)"
                value={it.qty_label ?? ""} onChange={(e) => update(idx, { qty_label: e.target.value })} />
              <div className="col-span-12 mb-2 border-b border-border/60 sm:col-span-7" />
            </>
          )}
        </div>
      ))}
      {!readOnly && (
        <button type="button" className="btn-ghost w-full border-dashed" onClick={() => onChange([...items, { product_id: null, description: "", quantity: 1, unit_price: 0 }])}>
          <Plus className="h-4 w-4" /> Adicionar item
        </button>
      )}
      <div className="flex justify-end pt-1 text-sm">
        <span className="text-muted-foreground">Subtotal:&nbsp;</span><span className="font-bold">{brl(itemsTotal(items))}</span>
      </div>
    </div>
  );
}
