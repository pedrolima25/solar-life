"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Loading } from "@/components/ui";
import { canSeePage } from "@/lib/permissions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) router.replace("/");
    else setReady(true);
  }, [router]);

  if (!ready) return <Loading />;

  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="px-4 py-6 lg:ml-64 lg:px-8">
        {canSeePage(pathname) ? children : (
          <div className="card mx-auto mt-10 max-w-md p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-3 text-lg font-bold">Acesso restrito</h1>
            <p className="mt-1 text-sm text-muted-foreground">Seu nível de usuário não tem acesso a esta página. Fale com o administrador.</p>
            <Link href="/dashboard" className="btn-primary mt-5">Voltar ao painel</Link>
          </div>
        )}
      </main>
    </div>
  );
}
