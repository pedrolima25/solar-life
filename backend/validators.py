"""Validações de documentos e contatos brasileiros (as mesmas regras do frontend em lib/validation.ts)."""
import re


def digits(v: str | None) -> str:
    return re.sub(r"\D", "", v or "")


def cpf_ok(v: str) -> bool:
    d = digits(v)
    if len(d) != 11 or d == d[0] * 11:
        return False
    for n in (9, 10):
        s = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if (s * 10 % 11) % 10 != int(d[n]):
            return False
    return True


def cnpj_ok(v: str) -> bool:
    d = digits(v)
    if len(d) != 14 or d == d[0] * 14:
        return False
    for n in (12, 13):
        pesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] if n == 12 else [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        s = sum(p * int(d[i]) for i, p in enumerate(pesos))
        dv = 0 if s % 11 < 2 else 11 - s % 11
        if dv != int(d[n]):
            return False
    return True


def email_ok(v: str) -> bool:
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]{2,}", v.strip()))


def phone_ok(v: str) -> bool:
    return len(digits(v)) in (10, 11)


def cep_ok(v: str) -> bool:
    return len(digits(v)) == 8


# ── Funções para usar nos field_validator do Pydantic (texto vazio vira None) ──
def opt_email(v: str | None) -> str | None:
    if not v or not v.strip():
        return None
    if not email_ok(v):
        raise ValueError("E-mail inválido.")
    return v.strip().lower()


def opt_phone(v: str | None) -> str | None:
    if not v or not v.strip():
        return None
    if not phone_ok(v):
        raise ValueError("Telefone deve ter DDD + número (10 ou 11 dígitos).")
    return v.strip()


def opt_cep(v: str | None) -> str | None:
    if not v or not v.strip():
        return None
    if not cep_ok(v):
        raise ValueError("CEP deve ter 8 dígitos.")
    return v.strip()


def opt_cnpj(v: str | None) -> str | None:
    if not v or not v.strip():
        return None
    if not cnpj_ok(v):
        raise ValueError("CNPJ inválido.")
    return v.strip()


def required(x: str) -> str:
    """Texto obrigatório (sem aceitar só espaços)."""
    if not x or not x.strip():
        raise ValueError("Campo obrigatório.")
    return x.strip()
