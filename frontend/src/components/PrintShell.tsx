"use client";

import { Printer } from "lucide-react";
import { DEFAULT_LOGO } from "@/lib/proposal";
import { useEffect } from "react";

/** Layout claro para impressão / salvar em PDF. */
export function PrintShell({ company, title, number, children }: {
  company: any;
  title: string;
  number?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (wasDark) html.classList.add("dark"); };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end px-4">
        <button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir / Salvar PDF</button>
      </div>
      <div className="mx-auto max-w-[210mm] bg-white p-10 text-sm text-zinc-800 shadow-lg print:p-0 print:shadow-none">
        <header className="mb-6 flex items-start justify-between border-b-4 border-[#0b3a74] pb-4">
          <div className="flex items-center gap-3">
            <img src={company?.logo || DEFAULT_LOGO} alt="" className="h-20 w-20 object-contain" />
            <div>
              <p className="text-lg font-bold uppercase text-[#0b3a74]">{company?.name}</p>
              <p className="text-xs text-zinc-500">{[company?.cnpj && `CNPJ ${company.cnpj}`, company?.phone, company?.email].filter(Boolean).join(" · ")}</p>
              {company?.address && <p className="text-xs text-zinc-500">{company.address}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">{title}</p>
            {number !== undefined && <p className="text-2xl font-bold text-zinc-900">Nº {String(number).padStart(4, "0")}</p>}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="mb-2 border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wider text-amber-600">{title}</h2>
      {children}
    </section>
  );
}

export function PrintItems({ items }: { items: any[] }) {
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-zinc-100 text-left text-xs uppercase text-zinc-500">
          <th className="px-2 py-1.5">Descrição</th><th className="px-2 py-1.5 text-right">Qtd.</th>
          <th className="px-2 py-1.5 text-right">Unitário</th><th className="px-2 py-1.5 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i} className="border-b border-zinc-100">
            <td className="px-2 py-1.5">{it.description}</td>
            <td className="px-2 py-1.5 text-right">{it.quantity.toLocaleString("pt-BR")}</td>
            <td className="px-2 py-1.5 text-right">{brl(it.unit_price)}</td>
            <td className="px-2 py-1.5 text-right font-medium">{brl(it.quantity * it.unit_price)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
