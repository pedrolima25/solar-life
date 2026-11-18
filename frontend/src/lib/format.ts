export const brl = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const num = (v: number | null | undefined, digits = 0) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Datas "AAAA-MM-DD" são tratadas como data local (sem deslocamento de fuso). */
export function parseDate(v?: string | null): Date | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  // Datetimes do backend vêm sem fuso e já em horário local digitado
  return new Date(v);
}

export const date = (v?: string | null) => parseDate(v)?.toLocaleDateString("pt-BR") ?? "—";

export const dateTime = (v?: string | null) => {
  const d = parseDate(v);
  return d ? `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—";
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Valor para <input type="datetime-local"> */
export const toLocalInput = (v?: string | null) => (v ? v.slice(0, 16) : "");

export const whatsappLink = (phone?: string | null, text = "") => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
};
