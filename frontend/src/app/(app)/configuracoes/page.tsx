"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { Brand } from "@/components/Sizing";
import { focusFirstInvalid, toast } from "@/components/feedback";
import { ErrorBox, Field, Loading, PageHeader, useFormBinder } from "@/components/ui";
import { hasErrors, maskCNPJ, maskPhone, rules, validate } from "@/lib/validation";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { DEFAULT_LOGO, MESES } from "@/lib/proposal";

export default function ConfiguracoesPage() {
  const { data, loading, error } = useApi<any>("/company");
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const bind = useFormBinder(form ?? {}, setForm);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const e = validate(form, {
      name: [rules.required("Nome da empresa")],
      cnpj: [rules.cnpj()],
      email: [rules.email()],
      phone: [rules.phone()],
      tarifa_kwh: [rules.positive("Tarifa")],
      hsp_padrao: [rules.positive("HSP"), (v) => (Number(v) > 8 ? "HSP acima de 8 h/dia não é realista." : null)],
      custo_kwp: [rules.positive("Preço por kWp")],
      potencia_modulo_w: [rules.positive("Potência do módulo")],
    }) as Record<string, string>;
    setErrors(e);
    if (hasErrors(e)) { focusFirstInvalid(); return toast.warning("Confira os campos destacados", "Nada foi salvo ainda."); }
    setSaveError("");
    try {
      const { id, ...body } = form;
      await api("/company", { method: "PUT", json: body });
      setSaved(true);
      toast.success("Configurações salvas");
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setSaveError(e.message);
      toast.error(e, "Não foi possível salvar");
    }
  }

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800_000) return setSaveError("Logo muito grande (máx. 800 KB).");
    const reader = new FileReader();
    reader.onload = () => setForm((f: any) => ({ ...f, logo: reader.result as string }));
    reader.readAsDataURL(file);
  }

  const hsp: number[] = form?.hsp_mensal?.length === 12 ? form.hsp_mensal : Array(12).fill(form?.hsp_padrao ?? 5);
  const setHsp = (i: number, v: number) => setForm((f: any) => ({ ...f, hsp_mensal: hsp.map((h, j) => (j === i ? v : h)) }));

  if (loading || !form) return error ? <ErrorBox message={error} /> : <Loading />;

  return (
    <>
      <PageHeader title="Configurações" subtitle="Dados da empresa e parâmetros do dimensionamento solar">
        <button className="btn-primary" onClick={save}>{saved ? <><Check className="h-4 w-4" /> Salvo</> : "Salvar"}</button>
      </PageHeader>
      <ErrorBox message={saveError} />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Empresa</h2>
          <p className="mb-4 text-sm text-muted-foreground">Aparece no cabeçalho dos orçamentos e das ordens de serviço impressas.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome / Razão social" className="sm:col-span-2" required error={errors.name}><input className="input" {...bind("name")} /></Field>
            <Field label="CNPJ" error={errors.cnpj}><input className="input" inputMode="numeric" placeholder="00.000.000/0000-00" value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} /></Field>
            <Field label="Telefone / WhatsApp" error={errors.phone}><input className="input" inputMode="tel" placeholder="(95) 99999-9999" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} /></Field>
            <Field label="E-mail" className="sm:col-span-2" error={errors.email}><input className="input" type="email" {...bind("email")} /></Field>
            <Field label="Endereço" className="sm:col-span-2"><input className="input" {...bind("address")} /></Field>
            <Field label="Responsável técnico"><input className="input" {...bind("responsavel_tecnico")} /></Field>
            <Field label="CREA / CFT"><input className="input" {...bind("crea")} /></Field>
            <Field label="Slogan" className="sm:col-span-2"><input className="input" placeholder="A energia do futuro ao seu alcance." {...bind("slogan")} /></Field>
            <Field label="Logo" className="sm:col-span-2">
              <div className="flex items-center gap-4">
                <img src={form.logo || DEFAULT_LOGO} alt="Logo" className="h-20 w-20 rounded-xl bg-white object-contain p-1" />
                <div className="flex flex-wrap gap-2">
                  <label className="btn-ghost cursor-pointer py-1.5 text-xs">Trocar logo<input type="file" accept="image/*" className="hidden" onChange={pickLogo} /></label>
                  {form.logo && <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setForm({ ...form, logo: null })}>Usar logo padrão</button>}
                </div>
              </div>
            </Field>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Padrões do dimensionamento</h2>
          <p className="mb-4 text-sm text-muted-foreground">Valores usados no simulador quando o campo fica em branco.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tarifa de energia (R$/kWh)" error={errors.tarifa_kwh}><input className="input" type="number" min={0} step="0.01" {...bind("tarifa_kwh", "number")} /></Field>
            <Field label="HSP da região (h/dia)" error={errors.hsp_padrao}><input className="input" type="number" min={0} max={8} step="0.1" {...bind("hsp_padrao", "number")} /></Field>
            <Field label="Preço de venda por kWp (R$)" error={errors.custo_kwp}><input className="input" type="number" min={0} {...bind("custo_kwp", "number")} /></Field>
            <Field label="Potência do módulo padrão (W)" error={errors.potencia_modulo_w}><input className="input" type="number" min={0} {...bind("potencia_modulo_w", "number")} /></Field>
            <Field label="Preço de venda por kWh de bateria de lítio (R$)" className="sm:col-span-2"><input className="input" type="number" {...bind("custo_bateria_kwh", "number")} /></Field>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Dica: o HSP (horas de sol pleno) médio no Brasil fica entre 4,5 e 5,8. Consulte o valor da sua cidade no CRESESB/SunData.
          </p>
          <h3 className="mb-2 mt-5 text-sm font-semibold">Irradiação mês a mês (h/dia) — gráfico de geração da proposta</h3>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {MESES.map((m, i) => (
              <Field key={m} label={m}><input className="input px-2" type="number" step="0.01" value={hsp[i]} onChange={(e) => setHsp(i, Number(e.target.value))} /></Field>
            ))}
          </div>
        </section>

        <section className="card p-5 xl:col-span-2">
          <h2 className="mb-4 font-semibold">Textos padrão da proposta</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="O que está contemplado"><textarea className="input" rows={6} {...bind("escopo_padrao")} /></Field>
            <Field label="Observações técnicas e comerciais (uma por linha)"><textarea className="input" rows={6} {...bind("observacoes_padrao")} /></Field>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">A observação da relação CC/CA do inversor e a validade da proposta são geradas automaticamente.</p>
        </section>

        <MarcasSection />
      </div>
    </>
  );
}

/** Marcas de inversor e painel que aparecem nos dropdowns do orçamento. Salva na hora. */
function MarcasSection() {
  const [marcas, setMarcas] = useState<Brand[]>([]);
  const [novo, setNovo] = useState<Record<Brand["tipo"], string>>({ inversor: "", painel: "" });
  const [erro, setErro] = useState("");

  const carregar = () => api("/marcas").then(setMarcas).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function salvar(req: Promise<unknown>) {
    setErro("");
    try { await req; await carregar(); } catch (e: any) { setErro(e.message); }
  }

  const adicionar = (tipo: Brand["tipo"]) => {
    if (!novo[tipo].trim()) return;
    salvar(api("/marcas", { method: "POST", json: { nome: novo[tipo], tipo } }).then(() => setNovo((n) => ({ ...n, [tipo]: "" }))));
  };
  const alternar = (m: Brand) => salvar(api(`/marcas/${m.id}`, { method: "PUT", json: { nome: m.nome, tipo: m.tipo, ativo: !m.ativo } }));

  return (
    <section className="card p-5 xl:col-span-2">
      <h2 className="mb-1 font-semibold">Marcas de inversor e painel</h2>
      <p className="mb-4 text-xs text-muted-foreground">Aparecem nos dropdowns do orçamento. Clique numa marca para ativar ou desativar; as desativadas somem da lista, mas os orçamentos antigos continuam com elas.</p>
      <ErrorBox message={erro} />
      <div className="grid gap-6 lg:grid-cols-2">
        {(["inversor", "painel"] as const).map((tipo) => (
          <div key={tipo}>
            <p className="label">{tipo === "inversor" ? "Inversores" : "Painéis"}</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {marcas.filter((m) => m.tipo === tipo).map((m) => (
                <button key={m.id} type="button" onClick={() => alternar(m)} title={m.ativo ? "Clique para desativar" : "Clique para ativar"}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${m.ativo ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground line-through opacity-60"}`}>
                  {m.ativo && <Check className="h-3 w-3" />} {m.nome}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input className="input" placeholder={`Nova marca de ${tipo}`} maxLength={60} value={novo[tipo]}
                onChange={(e) => setNovo((n) => ({ ...n, [tipo]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") adicionar(tipo); }} />
              <button type="button" className="btn-primary px-3" onClick={() => adicionar(tipo)}>Adicionar</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
