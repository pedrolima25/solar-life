/** Validações e máscaras usadas nos formulários (as mesmas regras são conferidas no backend). */

export const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

function cpfOk(cpf: string) {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(cpf[i]) * (n + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(cpf[n])) return false;
  }
  return true;
}

function cnpjOk(cnpj: string) {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  for (const n of [12, 13]) {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + p * Number(cnpj[i]), 0);
    const dv = s % 11 < 2 ? 0 : 11 - (s % 11);
    if (dv !== Number(cnpj[n])) return false;
  }
  return true;
}

export const isCPF = (v: string) => cpfOk(digits(v));
export const isCNPJ = (v: string) => cnpjOk(digits(v));
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isPhone = (v: string) => [10, 11].includes(digits(v).length);
export const isCEP = (v: string) => digits(v).length === 8;

// ── Máscaras (aplicadas enquanto digita) ────────────────────────
export function maskCPF(v: string) {
  return digits(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export function maskCNPJ(v: string) {
  return digits(v).slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}
export function maskPhone(v: string) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export const maskCEP = (v: string) => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

// ── Regras para montar a validação de um formulário ─────────────
type Rule = (v: any) => string | null;

export const rules = {
  required: (label = "Campo"): Rule => (v) =>
    v === null || v === undefined || (typeof v === "string" && !v.trim()) ? `${label}: campo obrigatório.` : null,
  email: (): Rule => (v) => (v && !isEmail(v) ? "E-mail inválido." : null),
  phone: (): Rule => (v) => (v && !isPhone(v) ? "Telefone deve ter DDD + número (10 ou 11 dígitos)." : null),
  cep: (): Rule => (v) => (v && !isCEP(v) ? "CEP deve ter 8 dígitos." : null),
  cpf: (): Rule => (v) => (v && !isCPF(v) ? "CPF inválido." : null),
  cnpj: (): Rule => (v) => (v && !isCNPJ(v) ? "CNPJ inválido." : null),
  min: (n: number, label = "Valor"): Rule => (v) => (v !== null && v !== undefined && v !== "" && Number(v) < n ? `${label} deve ser no mínimo ${n}.` : null),
  positive: (label = "Valor"): Rule => (v) => (v === null || v === undefined || v === "" || !(Number(v) > 0) ? `${label} deve ser maior que zero.` : null),
  minLength: (n: number, label = "Campo"): Rule => (v) => (v && String(v).length < n ? `${label} deve ter pelo menos ${n} caracteres.` : null),
};

export type Errors<T> = Partial<Record<keyof T, string>>;

/** Aplica as regras de cada campo e devolve só os campos com erro (objeto vazio = tudo certo). */
export function validate<T extends Record<string, any>>(form: T, schema: Partial<Record<keyof T, Rule[]>>): Errors<T> {
  const errors: Errors<T> = {};
  for (const key of Object.keys(schema) as (keyof T)[]) {
    for (const rule of schema[key] ?? []) {
      const msg = rule(form[key]);
      if (msg) { errors[key] = msg; break; }
    }
  }
  return errors;
}

export const hasErrors = (e: object) => Object.keys(e).length > 0;
