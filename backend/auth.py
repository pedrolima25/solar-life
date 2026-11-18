import datetime
import os

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import models
from database import get_db

PRODUCTION = os.getenv("ENV", "").lower() == "production"
_DEFAULT_KEY = "troque-esta-chave-em-producao-0123456789abcdef"
SECRET_KEY = os.getenv("SECRET_KEY", _DEFAULT_KEY)
if PRODUCTION and (SECRET_KEY == _DEFAULT_KEY or len(SECRET_KEY) < 32):
    raise RuntimeError("Defina SECRET_KEY (32+ caracteres aleatórios) para rodar em produção.")
ALGORITHM = "HS256"
TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "168"))

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/token")


def hash_password(password: str) -> str:
    return pwd.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd.verify(password, hashed)


def create_token(user: models.User) -> str:
    payload = {
        "sub": user.id,
        "role": user.role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> models.User:
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão expirada. Faça login novamente.")
    user = db.get(models.User, data.get("sub"))
    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário inválido.")
    return user


def admin_only(user: models.User = Depends(current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Apenas administradores.")
    return user


ADMIN, VENDEDOR, TECNICO = "admin", "vendedor", "tecnico"
GESTAO = (ADMIN, VENDEDOR)  # comercial / financeiro


def roles(*allowed: str):
    """Libera a rota só para os perfis informados."""
    def check(user: models.User = Depends(current_user)) -> models.User:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Seu nível de acesso não permite esta ação.")
        return user
    return check
