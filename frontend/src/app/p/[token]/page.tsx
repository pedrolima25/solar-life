"use client";

import { FileX2, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Presentation } from "@/components/Presentation";
import { API_URL } from "@/lib/api";

/** Link público da proposta: o cliente abre sem login e vê só a apresentação dele. */
export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/public/quotes/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || "Proposta não encontrada.");
        return r.json();
      })
      .then((d) => {
        setData(d);
        document.title = `Proposta de energia solar — ${d.client.name}`;
      })
      .catch((e) => setError(e.message || "Não foi possível abrir a proposta."));
  }, [token]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef3f9] p-6 text-zinc-800">
        <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm">
          <FileX2 className="mx-auto h-10 w-10 text-zinc-400" />
          <h1 className="mt-3 text-lg font-bold">Proposta indisponível</h1>
          <p className="mt-1 text-sm text-zinc-500">{error} Peça um novo link para quem te enviou a proposta.</p>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef3f9]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0b3a74]" />
      </main>
    );
  }

  const { quote: q, company, client } = data;
  const validoAte = new Date(new Date(q.created_at).getTime() + q.validity_days * 86400000);
  const vencida = validoAte < new Date() && q.status !== "Aprovado";

  return (
    <>
      {vencida && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Esta proposta venceu em {validoAte.toLocaleDateString("pt-BR")}. Os valores podem ter mudado — fale com a gente para atualizar.
        </div>
      )}
      <Presentation q={q} company={company} clientName={client.name} toolbar={null} />
    </>
  );
}
