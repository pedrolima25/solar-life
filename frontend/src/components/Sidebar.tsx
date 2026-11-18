"use client";

import {
  Calculator, Calendar, ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Moon,
  Package, RefreshCw, Settings, SolarPanel, Sun, UserCog, Users, Wallet, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { getUser, type User } from "@/lib/api";
import { ROLES } from "@/lib/constants";
import { canSeePage } from "@/lib/permissions";

const MENU = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/simulador", label: "Simulador Solar", icon: Calculator },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/os", label: "Ordens de Serviço", icon: ClipboardList },
  { href: "/manutencao", label: "Planos de Manutenção", icon: RefreshCw },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/instalacoes", label: "Instalações / Usinas", icon: SolarPanel },
  { href: "/estoque", label: "Materiais / Estoque", icon: Package },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, roles: ["admin", "vendedor"] },
  { href: "/usuarios", label: "Equipe", icon: UserCog, roles: ["admin"] },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setUser(getUser());
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  }

  const items = MENU.filter((m) => user && canSeePage(m.href, user.role));

  return (
    <>
      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
        <img src="/logo-solar-life.png" alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" />
        <span className="font-bold">Solar Life</span>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={clsx(
          "no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <img src="/logo-solar-life.png" alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-0.5 shadow-lg" />
            <div>
              <p className="font-bold leading-none">Solar Life</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-primary">Solar & Elétrica</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-muted lg:hidden" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {items.map((m) => {
            const active = pathname === m.href || pathname.startsWith(m.href + "/");
            return (
              <Link
                key={m.href}
                href={m.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-bold text-primary">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user ? ROLES[user.role] ?? user.role : ""}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={toggleTheme} className="btn-ghost px-2 py-2 text-xs">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {dark ? "Claro" : "Escuro"}
            </button>
            <button onClick={logout} className="btn-ghost px-2 py-2 text-xs text-red-500">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
