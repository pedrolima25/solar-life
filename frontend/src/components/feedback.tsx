"use client";

/**
 * Avisos do sistema no lugar de alert()/confirm()/prompt() do navegador.
 *
 *   toast.success("Cliente salvo")            toast.error(e)          toast.warning("...")   toast.info("...")
 *   if (await confirmDialog({ title: "Excluir cliente?", message: "...", danger: true })) { ... }
 *   const link = await copyText(url, "Link copiado")    // copia e avisa; se o navegador bloquear, mostra o texto para copiar
 *
 * Funcionam em qualquer lugar (não são hooks). O <FeedbackHost /> no layout raiz é quem desenha.
 */
import { AlertTriangle, CheckCircle2, Copy, Info, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

type Tone = "success" | "error" | "warning" | "info";
type Toast = { id: number; tone: Tone; title: string; message?: string };
type Confirm = {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** Texto exibido num campo para o usuário copiar (quando a cópia automática falha). */
  copyValue?: string;
  resolve: (ok: boolean) => void;
};

let pushToast: ((t: Omit<Toast, "id">) => void) | null = null;
let openConfirm: ((c: Confirm) => void) | null = null;

const msgOf = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : "Algo deu errado. Tente novamente.");

function show(tone: Tone, title: string, message?: string) {
  if (pushToast) pushToast({ tone, title, message });
  else if (typeof window !== "undefined") console.warn(title, message ?? "");
}

export const toast = {
  success: (title: string, message?: string) => show("success", title, message),
  /** Aceita um Error (usa a mensagem dele) ou um texto. */
  error: (e: unknown, title = "Não foi possível concluir") => show("error", title, msgOf(e)),
  warning: (title: string, message?: string) => show("warning", title, message),
  info: (title: string, message?: string) => show("info", title, message),
};

export function confirmDialog(opts: Omit<Confirm, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    if (openConfirm) openConfirm({ ...opts, resolve });
    else resolve(window.confirm(`${opts.title}${typeof opts.message === "string" ? `\n\n${opts.message}` : ""}`));
  });
}

/** Copia para a área de transferência e avisa. Se o navegador bloquear, abre uma janela com o texto selecionado. */
export async function copyText(text: string, successTitle = "Copiado!", successMessage?: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successTitle, successMessage);
  } catch {
    await confirmDialog({ title: "Copie o texto abaixo", copyValue: text, confirmText: "Fechar", cancelText: "" });
  }
}

/** Leva o cursor ao primeiro campo marcado com erro (depois que a tela redesenha). */
export function focusFirstInvalid() {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }, 60);
}

const TONES: Record<Tone, { icon: React.ElementType; bar: string; icon_: string }> = {
  success: { icon: CheckCircle2, bar: "bg-emerald-500", icon_: "text-emerald-500" },
  error: { icon: XCircle, bar: "bg-red-500", icon_: "text-red-500" },
  warning: { icon: AlertTriangle, bar: "bg-amber-500", icon_: "text-amber-500" },
  info: { icon: Info, bar: "bg-sky-500", icon_: "text-sky-500" },
};

function ToastItem({ t, onClose }: { t: Toast; onClose: () => void }) {
  const { icon: Icon, bar, icon_ } = TONES[t.tone];
  // Erros ficam mais tempo na tela; passar o mouse pausa
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(onClose, t.tone === "error" ? 7000 : 4000);
    return () => clearTimeout(id);
  }, [paused, onClose, t.tone]);

  return (
    <div role={t.tone === "error" ? "alert" : "status"} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      className="toast-in pointer-events-auto relative flex w-full gap-3 overflow-hidden rounded-xl border border-border bg-card py-3 pl-4 pr-10 shadow-2xl">
      <span className={clsx("absolute inset-y-0 left-0 w-1", bar)} />
      <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", icon_)} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t.title}</p>
        {t.message && <p className="mt-0.5 break-words text-sm text-muted-foreground">{t.message}</p>}
      </div>
      <button onClick={onClose} aria-label="Fechar aviso" className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ConfirmBox({ c, onDone }: { c: Confirm; onDone: (ok: boolean) => void }) {
  const okRef = useRef<HTMLButtonElement>(null);
  const copyRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    (c.copyValue ? copyRef.current : okRef.current)?.focus();
    copyRef.current?.select();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c, onDone]);

  const Icon = c.copyValue ? Copy : c.danger ? AlertTriangle : Info;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onDone(false)} />
      <div className="toast-in relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex gap-4">
          <div className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            c.danger ? "bg-red-500/15 text-red-500" : "bg-primary/15 text-primary")}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-base font-bold">{c.title}</h2>
            {c.message && <div className="mt-1 text-sm text-muted-foreground">{c.message}</div>}
            {c.copyValue && <input ref={copyRef} readOnly value={c.copyValue} className="input mt-3 text-xs" onFocus={(e) => e.target.select()} />}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          {c.cancelText !== "" && <button className="btn-ghost" onClick={() => onDone(false)}>{c.cancelText ?? "Cancelar"}</button>}
          <button ref={okRef} onClick={() => onDone(true)}
            className={c.danger ? "btn-danger-solid" : "btn-primary"}>
            {c.confirmText ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Desenha os avisos e a janela de confirmação. Montado uma vez no layout raiz. */
export function FeedbackHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    // Um sucesso tira da tela os avisos de "confira os campos" que ficaram para trás
    pushToast = (t) => setToasts((l) => [...(t.tone === "success" ? l.filter((x) => x.tone !== "warning") : l).slice(-3), { ...t, id: ++seq.current }]);
    openConfirm = (c) => setConfirm((prev) => { prev?.resolve(false); return c; });
    return () => { pushToast = null; openConfirm = null; };
  }, []);

  return (
    <>
      {/* No topo e centralizado: embaixo ficam os botões de salvar e nos cantos de cima o X das janelas */}
      <div className="pointer-events-none fixed inset-x-4 top-3 z-[80] mx-auto flex max-w-sm flex-col items-stretch gap-2" aria-live="polite">
        {toasts.map((t) => <ToastItem key={t.id} t={t} onClose={() => setToasts((l) => l.filter((x) => x.id !== t.id))} />)}
      </div>
      {confirm && <ConfirmBox c={confirm} onDone={(ok) => { confirm.resolve(ok); setConfirm(null); }} />}
    </>
  );
}
