"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PrintItems, PrintSection, PrintShell } from "@/components/PrintShell";
import { Loading } from "@/components/ui";
import { brl, date, dateTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";

export default function PrintOS() {
  const { id } = useParams<{ id: string }>();
  const { data: o } = useApi<any>(`/orders/${id}`);
  const { data: company } = useApi<any>("/company");
  const { data: client } = useApi<any>(o ? `/clients/${o.client_id}` : null);
  const { data: thumbs } = useApi<any[]>(`/orders/${id}/photos`);
  const { data: sig } = useApi<any>(o?.has_signature ? `/orders/${id}/signature` : null);
  // No relatório as fotos saem na resolução cheia (a lista só traz miniaturas)
  const [photos, setPhotos] = useState<any[] | null>(null);
  useEffect(() => {
    if (!thumbs) return;
    Promise.all(thumbs.map((p) => api(`/orders/${id}/photos/${p.id}`).catch(() => p)))
      .then(setPhotos);
  }, [thumbs, id]);

  if (!o || !company || !client || !photos || (o.has_signature && !sig)) return <Loading />;
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

      {photos.length > 0 && (
        <PrintSection title={`Relatório fotográfico (${photos.length})`}>
          <div className="grid grid-cols-2 gap-3">
            {photos.map((p, i) => (
              <figure key={p.id} className="break-inside-avoid overflow-hidden rounded border border-zinc-200">
                <img src={p.image || p.thumb} alt={p.legenda || `Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-2 py-1 text-[10.5px] leading-snug">
                  <b>{i + 1}.</b> {p.legenda || "Foto do serviço"}
                  <span className="block text-zinc-500">
                    {dateTime(p.taken_at || p.created_at)}
                    {p.lat != null && p.lng != null && ` · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </PrintSection>
      )}

      <p className="text-xs text-zinc-500">
        Garantia do serviço: {o.warranty_days} dias a partir da conclusão.{o.art_number ? ` ART/TRT nº ${o.art_number}.` : ""}
        {company.responsavel_tecnico ? ` Responsável técnico: ${company.responsavel_tecnico}${company.crea ? ` (${company.crea})` : ""}.` : ""}
      </p>

      {/* Mesma altura nas duas colunas: espaço da assinatura, linha, nome */}
      <div className="mt-10 grid break-inside-avoid grid-cols-2 gap-10 text-center text-xs">
        <div>
          <div className="h-20" />
          <div className="border-t border-zinc-400 pt-1">Técnico: {o.technician?.name ?? ""}</div>
        </div>
        <div>
          <div className="flex h-20 items-end justify-center">
            {/* multiply: o fundo branco da assinatura some e não cobre a linha */}
            {sig?.signature && <img src={sig.signature} alt={`Assinatura de ${sig.signed_by}`} className="max-h-20 object-contain mix-blend-multiply" />}
          </div>
          <div className="border-t border-zinc-400 pt-1">
            Cliente: {sig?.signed_by || c.name}
            {sig?.signed_at && <span className="block text-[10px] text-zinc-500">Assinado eletronicamente em {dateTime(sig.signed_at)}</span>}
          </div>
        </div>
      </div>
    </PrintShell>
  );
}
