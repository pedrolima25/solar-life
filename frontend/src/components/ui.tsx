"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import React, { useEffect } from "react";
import clsx from "clsx";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Modal({
  title, onClose, children, footer, size = "lg",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const widths = { md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl", "2xl": "max-w-6xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx("relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl", widths[size])}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, className, error, required, hint }: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Mensagem de validação: deixa o campo vermelho e mostra o texto embaixo. */
  error?: string | null;
  required?: boolean;
  hint?: React.ReactNode;
}) {
  // Marca o campo (input/select/textarea) como inválido para o leitor de tela e para o estilo vermelho
  const child = error && React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, { "aria-invalid": true })
    : children;
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}{required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}</span>
      {child}
      {error
        ? <span className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</span>
        : hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, list }: { status: string; list: { id: string; color: string }[] }) {
  const color = list.find((s) => s.id === status)?.color ?? "bg-muted text-muted-foreground border-border";
  return <Badge className={color}>{status}</Badge>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-5 w-5 animate-spin text-primary", className)} />;
}

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-muted-foreground">
      <Icon className="h-10 w-10 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function StatCard({
  label, value, icon: Icon, hint, tone = "amber",
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  hint?: React.ReactNode;
  tone?: "amber" | "sky" | "emerald" | "red" | "violet";
}) {
  const tones = {
    amber: "bg-amber-500/15 text-amber-500",
    sky: "bg-sky-500/15 text-sky-500",
    emerald: "bg-emerald-500/15 text-emerald-500",
    red: "bg-red-500/15 text-red-500",
    violet: "bg-violet-500/15 text-violet-500",
  };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-bold">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={clsx("rounded-xl p-2.5", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Garante que o erro apareça na tela mesmo com o formulário rolado para baixo
  useEffect(() => { if (message) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [message]);
  if (!message) return null;
  return (
    <div ref={ref} role="alert" className="toast-in mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Atalho para inputs controlados por objeto de formulário. */
export function useFormBinder<T extends Record<string, any>>(form: T, setForm: React.Dispatch<React.SetStateAction<T>>) {
  return (key: keyof T, type: "text" | "number" = "text") => ({
    value: form[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const raw = e.target.value;
      const value = type === "number" ? (raw === "" ? null : Number(raw)) : raw;
      setForm((f) => ({ ...f, [key]: value }));
    },
  });
}
