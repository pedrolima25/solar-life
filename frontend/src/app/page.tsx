"use client";

import { Sun, Zap, Wrench, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("token")) router.replace("/dashboard");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api("/auth/login", { method: "POST", json: { email, password } });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="solar-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <img src="/logo-solar-life.png" alt="Solar Life" className="h-28 w-28 rounded-2xl bg-white object-contain p-1.5 shadow-xl" />
          <span className="text-2xl font-bold">Solar Life Energia Renovável</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold leading-tight">Gestão completa para energia solar e serviços elétricos.</h1>
          <ul className="space-y-3 text-white/90">
            <li className="flex items-center gap-3"><Sun className="h-5 w-5" /> Dimensionamento e propostas fotovoltaicas</li>
            <li className="flex items-center gap-3"><Wrench className="h-5 w-5" /> Ordens de serviço e planos de manutenção</li>
            <li className="flex items-center gap-3"><Zap className="h-5 w-5" /> Agenda de técnicos, estoque e financeiro</li>
          </ul>
        </div>
        <p className="relative text-sm text-white/70">© {new Date().getFullYear()} Solar Life</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="flex items-center gap-3 lg:hidden">
            <img src="/logo-solar-life.png" alt="" className="h-16 w-16 rounded-2xl bg-white object-contain p-1" />
            <span className="text-2xl font-bold">Solar Life</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Entrar</h2>
            <p className="text-sm text-muted-foreground">Acesse com seu e-mail e senha.</p>
          </div>
          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
          <label className="block">
            <span className="label">E-mail</span>
            <input className="input" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Senha</span>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
