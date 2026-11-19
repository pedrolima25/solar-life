"use client";

/** Aba "Fotos e assinatura" da OS: fotos da obra (com local) e assinatura do cliente na tela. */
import { Camera, Check, ImagePlus, MapPin, PenLine, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { confirmDialog, toast } from "@/components/feedback";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { compressImage, currentPosition, mapsLink } from "@/lib/images";

/** Data/hora no fuso do aparelho, sem "Z" (o sistema guarda horário local, como as outras datas). */
const localISO = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 19);

type Photo = { id: string; legenda: string | null; thumb: string; lat: number | null; lng: number | null; taken_at: string | null; created_at: string; user?: { name: string } | null };

export function OSPhotosAndSignature({ osId, clientName, onSignatureChange }: {
  osId: string;
  clientName?: string;
  onSignatureChange?: (s: { signed_by: string | null; signed_at: string | null }) => void;
}) {
  return (
    <div className="space-y-8">
      <PhotosSection osId={osId} />
      <SignatureSection osId={osId} clientName={clientName} onChange={onSignatureChange} />
    </div>
  );
}

// ── Fotos ───────────────────────────────────────────────────────
function PhotosSection({ osId }: { osId: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [sending, setSending] = useState<{ done: number; total: number } | null>(null);
  const [open, setOpen] = useState<{ photo: Photo; image?: string } | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => api<Photo[]>(`/orders/${osId}/photos`).then(setPhotos).catch((e) => { toast.error(e, "Não foi possível carregar as fotos"); setPhotos([]); }), [osId]);
  useEffect(() => { load(); }, [load]);

  async function upload(files: FileList | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setSending({ done: 0, total: list.length });
    const pos = await currentPosition(); // uma vez por envio; se negar, segue sem local
    let ok = 0;
    for (const [i, file] of list.entries()) {
      try {
        const [image, thumb] = await Promise.all([compressImage(file, 1600, 0.8), compressImage(file, 360, 0.7)]);
        const p = await api<Photo>(`/orders/${osId}/photos`, {
          method: "POST",
          json: { image, thumb, lat: pos?.lat ?? null, lng: pos?.lng ?? null, taken_at: localISO(file.lastModified || Date.now()) },
        });
        setPhotos((l) => [...(l ?? []), p]);
        ok++;
      } catch (e) {
        toast.error(e, `Foto ${i + 1} não foi enviada`);
      }
      setSending({ done: i + 1, total: list.length });
    }
    setSending(null);
    if (ok) toast.success(ok === 1 ? "Foto adicionada" : `${ok} fotos adicionadas`, pos ? "Com a localização do aparelho." : "Sem localização (permissão negada ou indisponível).");
  }

  async function openPhoto(p: Photo) {
    setOpen({ photo: p });
    try {
      const full = await api<Photo & { image: string }>(`/orders/${osId}/photos/${p.id}`);
      setOpen((o) => (o?.photo.id === p.id ? { photo: p, image: full.image } : o));
    } catch (e) {
      toast.error(e, "Não foi possível abrir a foto");
      setOpen(null);
    }
  }

  async function caption(p: Photo, legenda: string) {
    if ((p.legenda ?? "") === legenda.trim()) return;
    try {
      const upd = await api<Photo>(`/orders/${osId}/photos/${p.id}`, { method: "PATCH", json: { legenda } });
      setPhotos((l) => l?.map((x) => (x.id === p.id ? upd : x)) ?? null);
      setOpen((o) => (o ? { ...o, photo: upd } : o));
    } catch (e) {
      toast.error(e, "Não foi possível salvar a legenda");
    }
  }

  async function remove(p: Photo) {
    if (!(await confirmDialog({ title: "Excluir esta foto?", message: p.legenda || undefined, danger: true, confirmText: "Excluir" }))) return;
    try {
      await api(`/orders/${osId}/photos/${p.id}`, { method: "DELETE" });
      setPhotos((l) => l?.filter((x) => x.id !== p.id) ?? null);
      setOpen(null);
      toast.success("Foto excluída");
    } catch (e) {
      toast.error(e, "Não foi possível excluir");
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Fotos do serviço {photos ? `(${photos.length})` : ""}</h3>
          <p className="text-xs text-muted-foreground">Antes, durante e depois. Saem no relatório impresso da OS.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-primary py-2" disabled={!!sending} onClick={() => camRef.current?.click()}>
            <Camera className="h-4 w-4" /> Tirar foto
          </button>
          <button type="button" className="btn-ghost py-2" disabled={!!sending} onClick={() => galRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> Da galeria
          </button>
        </div>
        {/* capture abre a câmera direto no celular; no computador abre o seletor de arquivos */}
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      </div>

      {sending && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <Spinner className="h-4 w-4" /> Enviando foto {Math.min(sending.done + 1, sending.total)} de {sending.total}…
          <div className="ml-auto h-1.5 w-32 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${(sending.done / sending.total) * 100}%` }} />
          </div>
        </div>
      )}

      {photos === null ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : photos.length === 0 ? (
        <button type="button" onClick={() => camRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border py-10 text-muted-foreground transition hover:border-primary hover:text-primary">
          <Camera className="h-8 w-8" />
          <span className="text-sm">Nenhuma foto ainda. Toque para tirar a primeira.</span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group overflow-hidden rounded-xl border border-border bg-background">
              <button type="button" className="block aspect-[4/3] w-full overflow-hidden bg-muted" onClick={() => openPhoto(p)} title="Ver foto">
                <img src={p.thumb} alt={p.legenda || "Foto do serviço"} className="h-full w-full object-cover transition group-hover:scale-105" />
              </button>
              <div className="space-y-1 p-2">
                <input className="w-full rounded-md bg-transparent px-1 py-0.5 text-xs outline-none focus:bg-muted" placeholder="Legenda (ex.: string box)"
                  defaultValue={p.legenda ?? ""} maxLength={200} onBlur={(e) => caption(p, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                <div className="flex items-center justify-between gap-1 px-1 text-[11px] text-muted-foreground">
                  <span className="truncate">{dateTime(p.taken_at || p.created_at)}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {p.lat != null && p.lng != null && (
                      <a href={mapsLink(p.lat, p.lng)} target="_blank" rel="noreferrer" className="rounded p-1 text-emerald-500 hover:bg-muted" title="Ver no mapa">
                        <MapPin className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button type="button" className="rounded p-1 text-red-500 hover:bg-muted" title="Excluir foto" onClick={() => remove(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-3 sm:p-6" onClick={() => setOpen(null)}>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <p className="truncate font-semibold">{open.photo.legenda || "Foto do serviço"}</p>
              <p className="text-xs text-white/60">
                {dateTime(open.photo.taken_at || open.photo.created_at)}{open.photo.user ? ` · ${open.photo.user.name}` : ""}
                {open.photo.lat != null && open.photo.lng != null && <> · <a className="underline" href={mapsLink(open.photo.lat, open.photo.lng)} target="_blank" rel="noreferrer">ver no mapa</a></>}
              </p>
            </div>
            <button className="rounded-lg p-2 hover:bg-white/10" onClick={() => setOpen(null)} aria-label="Fechar"><X className="h-6 w-6" /></button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {open.image
              ? <img src={open.image} alt={open.photo.legenda || "Foto do serviço"} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
              : <Spinner className="h-8 w-8 text-white" />}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Assinatura ──────────────────────────────────────────────────
function SignatureSection({ osId, clientName, onChange }: {
  osId: string;
  clientName?: string;
  onChange?: (s: { signed_by: string | null; signed_at: string | null }) => void;
}) {
  const [saved, setSaved] = useState<{ signature: string | null; signed_by: string | null; signed_at: string | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(clientName ?? "");
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    api(`/orders/${osId}/signature`).then((s) => { setSaved(s); setEditing(!s.signature); }).catch(() => setSaved({ signature: null, signed_by: null, signed_at: null }));
  }, [osId]);

  async function save() {
    if (name.trim().length < 2) return toast.warning("Informe o nome de quem assina");
    if (empty) return toast.warning("A assinatura está em branco", "Peça para o cliente assinar no quadro.");
    setSaving(true);
    try {
      const s = await api(`/orders/${osId}/signature`, { method: "PUT", json: { signature: pad.current!.toDataURL(), signed_by: name.trim() } });
      setSaved(s);
      setEditing(false);
      onChange?.({ signed_by: s.signed_by, signed_at: s.signed_at });
      toast.success("Assinatura registrada", `${s.signed_by} · ${dateTime(s.signed_at)}`);
    } catch (e) {
      toast.error(e, "Não foi possível salvar a assinatura");
    } finally {
      setSaving(false);
    }
  }

  async function redo() {
    const ok = await confirmDialog({ title: "Refazer a assinatura?", message: "A assinatura atual será apagada quando a nova for salva.", confirmText: "Refazer" });
    if (ok) { setEditing(true); setEmpty(true); }
  }

  return (
    <section>
      <h3 className="font-semibold">Assinatura do cliente</h3>
      <p className="mb-3 text-xs text-muted-foreground">Confirma que o serviço foi realizado. Sai no relatório impresso da OS.</p>

      {saved === null ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !editing && saved.signature ? (
        <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <img src={saved.signature} alt={`Assinatura de ${saved.signed_by}`} className="h-28 w-full max-w-sm rounded-lg bg-white object-contain p-1" />
          <div className="text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" /> Assinado</p>
            <p>{saved.signed_by}</p>
            <p className="text-xs text-muted-foreground">{dateTime(saved.signed_at)}</p>
            <button type="button" className="btn-ghost mt-2 py-1.5 text-xs" onClick={redo}><RotateCcw className="h-3.5 w-3.5" /> Refazer</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block max-w-sm">
            <span className="label">Nome de quem assina<span className="ml-0.5 text-red-500">*</span></span>
            <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </label>
          <SignaturePad ref={pad} onChange={setEmpty} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => { pad.current?.clear(); }}><RotateCcw className="h-4 w-4" /> Limpar</button>
            {saved.signature && <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>}
            <button type="button" className="btn-primary" disabled={saving} onClick={save}><PenLine className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar assinatura"}</button>
          </div>
        </div>
      )}
    </section>
  );
}

type SignaturePadHandle = { clear: () => void; toDataURL: () => string };

/** Quadro para assinar com o dedo ou o mouse (traço escuro sobre fundo branco, para imprimir bem). */
const SignaturePad = function SignaturePad({ ref, onChange }: { ref: React.Ref<SignaturePadHandle>; onChange: (empty: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.4;
    onChange(true);
  }, [onChange]);

  useEffect(() => { setup(); }, [setup]);

  // Expõe limpar/exportar para a seção de assinatura
  useEffect(() => {
    const handle: SignaturePadHandle = { clear: setup, toDataURL: () => canvasRef.current!.toDataURL("image/png") };
    if (typeof ref === "function") ref(handle);
    else if (ref) (ref as React.MutableRefObject<SignaturePadHandle | null>).current = handle;
  }, [ref, setup]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="relative max-w-xl">
      <canvas ref={canvasRef} className="h-44 w-full cursor-crosshair touch-none rounded-xl border-2 border-dashed border-border bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          last.current = point(e);
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.beginPath();
          ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = "#0f172a";
          ctx.fill();
          onChange(false);
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const p = point(e);
          const ctx = e.currentTarget.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
        }}
        onPointerUp={() => { drawing.current = false; last.current = null; }}
        onPointerCancel={() => { drawing.current = false; last.current = null; }} />
      <span className="pointer-events-none absolute bottom-3 left-4 right-4 border-t border-zinc-300 pt-1 text-center text-[11px] text-zinc-400">Assine aqui</span>
    </div>
  );
};
