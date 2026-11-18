"use client";

import { useParams } from "next/navigation";
import { PrintItems, PrintSection, PrintShell } from "@/components/PrintShell";
import { Loading } from "@/components/ui";
import { brl, date, dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export default function PrintOS() {
  const { id } = useParams<{ id: string }>();
  const { data: o } = useApi<any>(`/orders/${id}`);
  const { data: company } = useApi<any>("/company");
  const { data: client } = useApi<any>(o ? `/clients/${o.client_id}` : null);

  if (!o || !company || !client) return <Loading />;
  const c = client.client;
  const inst = client.installations.find((i: any) => i.id === o.installation_id);
  const measurements = Object.entries(o.measurements || {}).filter(([, v]) => v);

  return (
    <PrintShell company={company} title="Ordem de Serviço" number={o.number}>
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase text-zinc-500">Cliente</p>
          <p className="font-semibold text-zinc-900">{c.name}</p>
          <p>{[c.document, c.phone].filter(Boolean).join(" · ")}</p>
          <p><span className="text-zinc-500">Local:</span> {o.service_address || "—"}</p>
        </div>
        <div className="text-right">
          <p><span className="text-zinc-500">Serviço:</span> <b>{o.service_type}</b></p>
          <p><span className="text-zinc-500">Status:</span> {o.status} · <span className="text-zinc-500">Prioridade:</span> {o.priority}</p>
          <p><span className="text-zinc-500">Abertura:</span> {date(o.created_at?.slice(0, 10))}</p>
          {o.scheduled_date && <p><span className="text-zinc-500">Agendada:</span> {dateTime(o.scheduled_date)}</p>}
          <p><span className="text-zinc-500">Técnico:</span> {o.technician?.name ?? "—"}</p>
        </div>
      </div>

      {inst && (
        <PrintSection title="Instalação">
          <p><b>{inst.name}</b> — {inst.type}{inst.potencia_kwp ? ` · ${inst.potencia_kwp} kWp` : ""}{inst.num_modulos ? ` · ${inst.num_modulos} módulos` : ""}</p>
          <p className="text-zinc-600">{[inst.inversor_modelo && `Inversor: ${inst.inversor_modelo}`, inst.concessionaria && `Concessionária: ${inst.concessionaria}`, inst.unidade_consumidora && `UC: ${inst.unidade_consumidora}`].filter(Boolean).join(" · ")}</p>
        </PrintSection>
      )}

      <PrintSection title="Solicitação / defeito relatado"><p className="whitespace-pre-line">{o.problem || "—"}</p></PrintSection>
      {o.diagnosis && <PrintSection title="Diagnóstico técnico"><p className="whitespace-pre-line">{o.diagnosis}</p></PrintSection>}
      {o.solution && <PrintSection title="Serviço executado"><p className="whitespace-pre-line">{o.solution}</p></PrintSection>}

      {o.checklist?.length > 0 && (
        <PrintSection title="Checklist">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
            {o.checklist.map((c: any, i: number) => (
              <li key={i} className="flex gap-2"><span className="font-mono">{c.ok ? "[✓]" : "[  ]"}</span>{c.item}</li>
            ))}
          </ul>
        </PrintSection>
      )}

      {measurements.length > 0 && (
        <PrintSection title="Medições">
          <div className="grid grid-cols-4 gap-2">
            {measurements.map(([k, v]) => (
              <div key={k} className="rounded border border-zinc-200 p-1.5"><p className="text-[10px] text-zinc-500">{k}</p><p className="font-semibold">{String(v)}</p></div>
            ))}
          </div>
        </PrintSection>
      )}

      {o.items.length > 0 && (
        <PrintSection title="Materiais e serviços">
          <PrintItems items={o.items} />
          <p className="mt-2 text-right text-base font-bold text-zinc-900">Total: {brl(o.total)}</p>
        </PrintSection>
      )}

      <p className="text-xs text-zinc-500">
        Garantia do serviço: {o.warranty_days} dias a partir da conclusão.{o.art_number ? ` ART/TRT nº ${o.art_number}.` : ""}
        {company.responsavel_tecnico ? ` Responsável técnico: ${company.responsavel_tecnico}${company.crea ? ` (${company.crea})` : ""}.` : ""}
      </p>

      <div className="mt-16 grid grid-cols-2 gap-10 text-center text-xs">
        <div className="border-t border-zinc-400 pt-1">Técnico: {o.technician?.name ?? ""}</div>
        <div className="border-t border-zinc-400 pt-1">Cliente: {c.name}</div>
      </div>
    </PrintShell>
  );
}
