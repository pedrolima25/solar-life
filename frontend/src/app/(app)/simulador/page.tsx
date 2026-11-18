"use client";

import { Calculator, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EMPTY_SIZING, SizingForm, SizingResult, type SizingInput } from "@/components/Sizing";
import { Empty, PageHeader } from "@/components/ui";

export default function SimuladorPage() {
  const router = useRouter();
  const [input, setInput] = useState<SizingInput>(EMPTY_SIZING);
  const [result, setResult] = useState<any>(null);

  function createQuote() {
    sessionStorage.setItem("pending_sizing", JSON.stringify({ input, result }));
    router.push("/orcamentos?novo=solar");
  }

  return (
    <>
      <PageHeader title="Simulador Solar" subtitle="Dimensione sistemas On-Grid, Off-Grid ou Híbridos a partir do consumo do cliente">
        <button className="btn-primary" disabled={!result} onClick={createQuote}><FileText className="h-4 w-4" /> Gerar orçamento</button>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <section className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">Dados do cliente</h2>
          <SizingForm narrow input={input} onInput={setInput} onResult={setResult} />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Resultado</h2>
          {result ? <SizingResult r={result} /> : <Empty icon={Calculator} text="Informe o consumo médio mensal para ver o dimensionamento." />}
          {result && (
            <p className="mt-4 text-xs text-muted-foreground">
              Estimativa comercial: eficiência global de {Math.round(result.eficiencia * 100)}%, degradação de 0,5%/ano e reajuste de tarifa de 6%/ano.{" "}
              {result.tipo_sistema === "Off-Grid" ? "Sistema isolado: sem conta de luz nem custo de disponibilidade." : `Descontado o custo de disponibilidade de ${result.disponibilidade_kwh} kWh (${result.tipo_ligacao}).`} Confirme com o projeto técnico.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
