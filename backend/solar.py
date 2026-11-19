"""Dimensionamento de sistema fotovoltaico On-Grid, Off-Grid e Híbrido (estimativa comercial).

On-Grid (ligado à rede, sem bateria)
  consumo compensável = consumo médio - custo de disponibilidade (30/50/100 kWh)
  potência (kWp)      = consumo compensável / (HSP x 30 dias x eficiência)
  economia mensal     = min(geração, consumo compensável) x tarifa

Off-Grid (isolado, com baterias)
  potência (kWp)      = consumo total / (HSP x 30 x eficiência off-grid)   — sem rede, gera 100% do consumo
  banco (kWh)         = consumo diário x dias de autonomia / (profundidade de descarga x eficiência da bateria)
  economia            = custo evitado da energia (consumo x tarifa de referência)

Híbrido (ligado à rede + bateria de reserva)
  potência            = igual ao On-Grid
  banco (kWh)         = carga essencial (kW) x horas de reserva / (profundidade de descarga x eficiência)
  "Sem bateria"       = inversor híbrido sem banco: nenhuma bateria no orçamento, sistema preparado para
                        receber baterias depois

Quantidades informadas pelo vendedor substituem as calculadas:
  qtd_paineis   → kWp = qtd_paineis x potência do painel (W) / 1000
  qtd_baterias  → banco = qtd_baterias x capacidade da unidade

O fluxo de 25 anos considera degradação dos módulos, reajuste da tarifa e a troca das baterias
ao fim da vida útil.
"""
import math

DISPONIBILIDADE = {"Monofásico": 30, "Bifásico": 50, "Trifásico": 100}
AREA_POR_MODULO_M2 = 2.6      # módulo ~550 W (2,28 x 1,13 m) + espaçamento
DEGRADACAO_ANUAL = 0.005      # 0,5% ao ano
VIDA_UTIL_ANOS = 25
EFICIENCIA_OFF_GRID = 0.70    # perdas extras de carga/descarga da bateria e do controlador
EFICIENCIA_BATERIA = 0.95

TIPOS_SISTEMA = ("On-Grid", "Off-Grid", "Híbrido")
SEM_BATERIA = "Sem bateria"

# Profundidade de descarga, capacidade de cada unidade, vida útil e custo relativo
BATERIAS = {
    "Lítio": {"dod": 0.90, "unidade_kwh": 5.12, "unidade_desc": "48 V 100 Ah (5,12 kWh)", "por_serie": 1,
              "vida_anos": 12, "fator_custo": 1.0},
    "Chumbo-ácido": {"dod": 0.50, "unidade_kwh": 2.64, "unidade_desc": "12 V 220 Ah (2,64 kWh)", "por_serie": 4,
                     "vida_anos": 5, "fator_custo": 0.25},
}


def kwp(qtd_paineis: float, potencia_painel_w: float) -> float:
    """Potência pico do gerador: quantidade de painéis x potência do painel."""
    return round((qtd_paineis or 0) * (potencia_painel_w or 0) / 1000, 2)


def _banco(energia_util_kwh: float, tipo_bateria: str, tensao_banco: int, custo_bateria_kwh: float,
           qtd_baterias: int | None = None) -> dict:
    b = BATERIAS.get(tipo_bateria, BATERIAS["Lítio"])
    if qtd_baterias:
        unidades = qtd_baterias   # informada pelo vendedor
    else:
        nominal = energia_util_kwh / (b["dod"] * EFICIENCIA_BATERIA) if energia_util_kwh else 0
        unidades = math.ceil(nominal / b["unidade_kwh"]) if nominal else 0
        # Baterias de 12 V precisam de séries completas para formar 48 V (4 unidades)
        por_serie = b["por_serie"] * max(tensao_banco // 48, 1) if tipo_bateria == "Chumbo-ácido" else b["por_serie"]
        if unidades and unidades % por_serie:
            unidades += por_serie - unidades % por_serie
    if not unidades:
        raise ValueError("Informe a quantidade de baterias (maior que zero) ou escolha “Sem bateria”.")
    nominal_real = unidades * b["unidade_kwh"]
    return {
        "tipo_bateria": tipo_bateria if tipo_bateria in BATERIAS else "Lítio",
        "tensao_banco": tensao_banco,
        "num_baterias": unidades,
        "bateria_unidade": b["unidade_desc"],
        "banco_kwh": round(nominal_real, 2),                         # capacidade nominal instalada
        "banco_util_kwh": round(nominal_real * b["dod"], 2),         # energia utilizável
        "banco_ah": round(nominal_real * 1000 / tensao_banco) if tensao_banco else 0,
        "vida_bateria_anos": b["vida_anos"],
        "custo_baterias": round(nominal_real * custo_bateria_kwh * b["fator_custo"], 2),
    }


def dimensionar(consumo_kwh: float, tipo_ligacao: str, hsp: float, potencia_modulo_w: int,
                tarifa_kwh: float, custo_kwp: float, eficiencia: float = 0.80,
                reajuste_anual: float = 0.06, tipo_sistema: str = "On-Grid",
                tipo_bateria: str = "Lítio", autonomia_dias: float = 1.0,
                carga_essencial_kw: float = 1.5, horas_backup: float = 4.0,
                tensao_banco: int = 48, custo_bateria_kwh: float = 2800.0,
                qtd_paineis: int | None = None, qtd_baterias: int | None = None) -> dict:
    if tipo_sistema not in TIPOS_SISTEMA:
        tipo_sistema = "On-Grid"
    off_grid = tipo_sistema == "Off-Grid"
    sem_bateria = tipo_sistema == "Híbrido" and tipo_bateria == SEM_BATERIA
    if off_grid and tipo_bateria == SEM_BATERIA:
        raise ValueError("Sistema Off-Grid precisa de baterias: escolha Lítio ou Chumbo-ácido.")
    com_bateria = tipo_sistema != "On-Grid" and not sem_bateria

    disponibilidade = 0 if off_grid else DISPONIBILIDADE.get(tipo_ligacao, 50)
    if off_grid:
        eficiencia = min(eficiencia, EFICIENCIA_OFF_GRID)
    alvo = consumo_kwh if off_grid else max(consumo_kwh - disponibilidade, 0)
    fator = hsp * 30 * eficiencia

    kwp_necessario = alvo / fator if fator else 0
    num_modulos_sugerido = max(math.ceil(kwp_necessario * 1000 / potencia_modulo_w), 1) if alvo else 0
    num_modulos = qtd_paineis or num_modulos_sugerido
    kwp_real = kwp(num_modulos, potencia_modulo_w)
    geracao_mensal = kwp_real * fator
    consumo_diario = consumo_kwh / 30

    if off_grid:
        # Inversor off-grid atende o pico das cargas; estimado pelo consumo (mín. 1 kW)
        inversor_kw = round(max(kwp_real / 1.2, consumo_diario / 6, 1.0), 1)
    else:
        # Inversor dimensionado com ~20% de sobrecarga (oversizing) admitida
        inversor_kw = round(kwp_real / 1.2, 1)

    banco = {}
    if off_grid:
        banco = _banco(consumo_diario * autonomia_dias, tipo_bateria, tensao_banco, custo_bateria_kwh, qtd_baterias)
        banco["autonomia_dias"] = autonomia_dias
        # Controlador de carga MPPT: corrente dos módulos no banco + 25% de margem
        banco["controlador_a"] = math.ceil(kwp_real * 1000 / tensao_banco * 1.25) if tensao_banco else 0
    elif com_bateria:
        banco = _banco(carga_essencial_kw * horas_backup, tipo_bateria, tensao_banco, custo_bateria_kwh, qtd_baterias)
        banco["carga_essencial_kw"] = carga_essencial_kw
        banco["horas_backup"] = horas_backup
        inversor_kw = max(inversor_kw, round(carga_essencial_kw * 1.25, 1))
    elif sem_bateria:
        # Inversor híbrido sem banco: nenhuma bateria no orçamento, pronto para receber depois
        banco = {"tipo_bateria": SEM_BATERIA, "num_baterias": 0, "banco_kwh": 0, "banco_util_kwh": 0,
                 "custo_baterias": 0.0, "preparado_expansao": True}

    if off_grid:
        # Sem conta de luz: a economia é o custo da energia que seria comprada
        economia_mensal = min(geracao_mensal, consumo_kwh) * tarifa_kwh
        conta_atual = consumo_kwh * tarifa_kwh
        conta_nova = 0.0
    else:
        economia_mensal = min(geracao_mensal, alvo) * tarifa_kwh
        conta_atual = consumo_kwh * tarifa_kwh
        conta_nova = max(conta_atual - economia_mensal, disponibilidade * tarifa_kwh)

    custo_baterias = banco.get("custo_baterias", 0.0)
    investimento = kwp_real * custo_kwp + custo_baterias
    vida_bateria = banco.get("vida_bateria_anos")

    # Fluxo de 25 anos com degradação, reajuste de tarifa e troca das baterias
    acumulado = -investimento
    payback_anos = None
    economia_25 = 0.0
    fluxo = []
    for ano in range(1, VIDA_UTIL_ANOS + 1):
        fator_geracao = (1 - DEGRADACAO_ANUAL) ** (ano - 1)
        fator_tarifa = (1 + reajuste_anual) ** (ano - 1)
        economia_ano = economia_mensal * 12 * fator_geracao * fator_tarifa
        # Troca as baterias ao fim da vida útil, mas não nos últimos anos do sistema (não compensaria)
        restante = VIDA_UTIL_ANOS - ano + 1
        troca = (custo_baterias if vida_bateria and ano > 1 and (ano - 1) % vida_bateria == 0
                 and restante >= vida_bateria / 2 else 0.0)
        liquido = economia_ano - troca
        economia_25 += liquido
        acumulado += liquido
        fluxo.append({"ano": ano, "economia": round(liquido, 2), "acumulado": round(acumulado, 2),
                      "troca_baterias": round(troca, 2)})

    # Payback: a partir de quando o saldo fica positivo e não volta a ficar negativo
    # (a troca de baterias pode deixar o saldo negativo de novo)
    negativos = [i for i, f in enumerate(fluxo) if f["acumulado"] < 0]
    if not negativos and fluxo and fluxo[0]["economia"] > 0:
        payback_anos = round(investimento / fluxo[0]["economia"], 1)
    elif negativos and negativos[-1] < len(fluxo) - 1:
        i = negativos[-1]
        payback_anos = round(fluxo[i]["ano"] + (-fluxo[i]["acumulado"] / fluxo[i + 1]["economia"]), 1)

    return {
        "tipo_sistema": tipo_sistema,
        "consumo_kwh": consumo_kwh,
        "tipo_ligacao": tipo_ligacao,
        "disponibilidade_kwh": disponibilidade,
        "hsp": hsp,
        "eficiencia": eficiencia,
        "tarifa_kwh": tarifa_kwh,
        "custo_kwp": custo_kwp,
        "potencia_modulo_w": potencia_modulo_w,
        "kwp_necessario": round(kwp_necessario, 2),
        "num_modulos": num_modulos,
        "num_modulos_sugerido": num_modulos_sugerido,
        # Quantidades digitadas pelo vendedor (None = automático); usadas para reabrir o formulário
        "qtd_paineis": qtd_paineis or None,
        "qtd_baterias": (qtd_baterias or None) if com_bateria else None,
        "kwp_real": round(kwp_real, 2),
        "inversor_kw": inversor_kw,
        "geracao_mensal_kwh": round(geracao_mensal, 1),
        "geracao_anual_kwh": round(geracao_mensal * 12, 0),
        "area_m2": round(num_modulos * AREA_POR_MODULO_M2, 1),
        "conta_atual": round(conta_atual, 2),
        "conta_nova": round(conta_nova, 2),
        "economia_mensal": round(economia_mensal, 2),
        "economia_anual": round(economia_mensal * 12, 2),
        "investimento": round(investimento, 2),
        "payback_anos": payback_anos,
        "economia_25_anos": round(economia_25, 2),
        # Fator médio do SIN ~0,0617 tCO2/MWh
        "co2_evitado_ton_ano": round(geracao_mensal * 12 * 0.0617 / 1000, 2),
        "fluxo": fluxo,
        **banco,
    }
