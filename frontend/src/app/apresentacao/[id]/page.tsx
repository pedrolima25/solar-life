"use client";

import { useParams } from "next/navigation";
import { Presentation } from "@/components/Presentation";
import { Loading } from "@/components/ui";
import { useApi } from "@/lib/hooks";

export default function ApresentacaoInterna() {
  const { id } = useParams<{ id: string }>();
  const { data: q } = useApi<any>(`/quotes/${id}`);
  const { data: company } = useApi<any>("/company");
  const { data: products } = useApi<any[]>("/products");
  const { data: client } = useApi<any>(q ? `/clients/${q.client_id}` : null);

  if (!q || !company || !client || !products) return <Loading />;
  return <Presentation q={q} company={company} clientName={client.client.name} products={products} />;
}
