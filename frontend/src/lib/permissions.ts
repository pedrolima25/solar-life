/**
 * Permissões por nível de usuário (espelham as regras do backend em auth.roles).
 *   admin    → tudo
 *   vendedor → comercial (simulador, orçamentos, clientes); sem financeiro; não exclui nem altera catálogo/equipe/configurações
 *   tecnico  → OS e agenda dele, consulta de clientes/estoque/planos; sem valores comerciais
 */
import { getUser } from "./api";

export type Perm =
  | "comercial"      // simulador, orçamentos
  | "financeiro"
  | "editarClientes"
  | "editarCatalogo" // criar/editar/excluir produtos e preços
  | "movimentarEstoque"
  | "editarPlanos"
  | "excluir"        // excluir clientes, OS, instalações, planos, lançamentos
  | "excluirAgenda"
  | "admin";         // equipe e configurações

const REGRAS: Record<Perm, string[]> = {
  comercial: ["admin", "vendedor"],
  financeiro: ["admin"],
  editarClientes: ["admin", "vendedor"],
  editarCatalogo: ["admin"],
  movimentarEstoque: ["admin", "vendedor"],
  editarPlanos: ["admin", "vendedor"],
  excluir: ["admin"],
  excluirAgenda: ["admin", "vendedor"],
  admin: ["admin"],
};

export function can(perm: Perm, role = getUser()?.role): boolean {
  return !!role && REGRAS[perm].includes(role);
}

/** Páginas que exigem uma permissão (as demais são liberadas para todos os níveis). */
export const PAGE_PERM: Record<string, Perm> = {
  "/simulador": "comercial",
  "/orcamentos": "comercial",
  "/financeiro": "financeiro",
  "/usuarios": "admin",
  "/configuracoes": "admin",
};

export function canSeePage(pathname: string, role = getUser()?.role): boolean {
  const key = Object.keys(PAGE_PERM).find((p) => pathname === p || pathname.startsWith(p + "/"));
  return !key || can(PAGE_PERM[key], role);
}
