"use client";

import {
  AlertTriangle, Calendar, ClipboardList, FileText, Package, RefreshCw, SolarPanel,
  TrendingDown, TrendingUp, Users, Wallet,
} from "lucide-react";
import Link from "next/link";
import { ErrorBox, Loading, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { OS_STATUS } from "@/lib/constants";
import { brl, date, dateTime, num } from "@/lib/format";
import { can } from "@/lib/permissions";
import { useApi } from "@/lib/hooks";

export default function Dashboard() {
  const { data, loading, error } = useApi<any>("/dashboard");

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error} />;

  return (
    <>
      <PageHeader title="Painel" subtitle="Visão geral da operação">
        {can("comercial") && <Link href="/simulador" className="btn-ghost">Simular sistema solar</Link>}
        <Link href="/os?novo=1" className="btn-primary">Nova OS</Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="OS em aberto" value={data.open_orders} icon={ClipboardList} tone="sky" />
        {can("comercial") && <StatCard label="Orçamentos abertos" value={data.quotes_open} hint={brl(data.quotes_open_value)} icon={FileText} tone="violet" />}
        {can("financeiro") && <>
        <StatCard label="Recebido no mês" value={brl(data.revenue_month)} hint={`A receber: ${brl(data.receivable_month)}`} icon={TrendingUp} tone="emerald" />
        <StatCard label="Despesas no mês" value={brl(data.expense_month)} icon={TrendingDown} tone="red" />
        </>}
        <StatCard label="Clientes" value={data.clients} icon={Users} />
        <StatCard label="Instalações" value={data.installations} hint={`${num(data.kwp_installed, 2)} kWp instalados`} icon={SolarPanel} />
        {can("financeiro") && <>
        <StatCard label="Em atraso" value={brl(data.overdue)} hint="Recebimentos vencidos" icon={AlertTriangle} tone={data.overdue > 0 ? "red" : "emerald"} />
        <StatCard label="Saldo do mês" value={brl(data.revenue_month - data.expense_month)} icon={Wallet} tone="amber" />
        </>}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4 text-primary" /> OS por status</h2>
          <ul className="space-y-2">
            {OS_STATUS.map((s) => (
              <li key={s.id} className="flex items-center justify-between">
                <StatusBadge status={s.id} list={OS_STATUS} />
                <span className="font-semibold">{data.orders_by_status[s.id] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Calendar className="h-4 w-4 text-primary" /> Próximos agendamentos</h2>
          {data.upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nenhum agendamento futuro.</p>}
          <ul className="space-y-3">
            {data.upcoming.map((a: any) => (
              <li key={a.id} className="rounded-xl bg-muted/60 p-3 text-sm">
                <p className="font-semibold">{a.title}</p>
                <p className="text-muted-foreground">{dateTime(a.start)} · {a.type}</p>
                {(a.client || a.technician) && (
                  <p className="text-xs text-muted-foreground">{[a.client, a.technician && `Téc.: ${a.technician}`].filter(Boolean).join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4 text-primary" /> Manutenções a vencer (15 dias)</h2>
          {data.due_plans.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma manutenção próxima.</p>}
          <ul className="space-y-2">
            {data.due_plans.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.client}</p>
                </div>
                <span className={p.overdue ? "font-semibold text-red-500" : "text-muted-foreground"}>{date(p.next_date)}</span>
              </li>
            ))}
          </ul>
          {data.due_plans.length > 0 && <Link href="/manutencao" className="mt-4 inline-block text-sm font-semibold text-primary">Gerar OS →</Link>}

          {data.low_stock.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 flex items-center gap-2 font-semibold"><Package className="h-4 w-4 text-red-500" /> Estoque baixo</h2>
              <ul className="space-y-1 text-sm">
                {data.low_stock.map((p: any) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="font-semibold text-red-500">{num(p.stock)} {p.unit}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
