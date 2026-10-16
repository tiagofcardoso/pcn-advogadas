#!/bin/bash

# ==========================================
# Script de Setup — App PCN Advogadas 1.0
# ==========================================
set -e

PROJECT_NAME="pcn-advogadas-api"

echo "==> A criar a estrutura de diretórios para o projeto '$PROJECT_NAME'..."

mkdir -p $PROJECT_NAME/src/core
mkdir -p $PROJECT_NAME/src/models
mkdir -p $PROJECT_NAME/src/schemas
mkdir -p $PROJECT_NAME/src/repositories
mkdir -p $PROJECT_NAME/src/services
mkdir -p $PROJECT_NAME/src/api/v1
mkdir -p $PROJECT_NAME/src/assets

cd $PROJECT_NAME

echo "==> A gerar o .gitignore..."
cat << 'EOF' > .gitignore
# Ambientes e Segredos
.env
.env.*
!.env.example
*.pem
*.key
*.crt

# Python
__pycache__/
*.py[cod]
*$py.class
.venv/
venv/
dist/
build/
*.egg-info/

# IDEs & SO
.vscode/
.idea/
.DS_Store
*.swp

# Logs e Dados locais
*.sqlite3
*.log
EOF

echo "==> A gerar o .env.example..."
cat << 'EOF' > .env.example
# Configuração do Ambiente
ENVIRONMENT=production
PROJECT_NAME="App PCN Advogadas"
API_V1_STR="/api/v1"

# Segurança & JWT (Gerar chave com: openssl rand -hex 32)
SECRET_KEY=sua_chave_secreta_super_segura_aqui
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS (Domínios permitidos separados por vírgula)
BACKEND_CORS_ORIGINS=https://app.pcnadvogadas.pt

# Base de Dados MySQL (WebTuga)
DATABASE_URL=mysql+asyncmy://utilizador_webtuga:senha_segura@localhost:3306/base_dados_pcn?charset=utf8mb4
EOF

echo "==> A gerar o pyproject.toml / requirements.txt..."
cat << 'EOF' > requirements.txt
fastapi>=0.110.0
uvicorn[standard]>=0.28.0
sqlalchemy>=2.0.0
asyncmy>=0.2.9
pydantic[email]>=2.6.0
pydantic-settings>=2.2.0
passlib[argon2]>=1.7.4
pyjwt>=2.8.0
pyotp>=2.9.0
qrcode[pil]>=7.4.2
python-multipart>=0.0.9
openpyxl>=3.1.2
alembic>=1.13.1
EOF

echo "==> A gerar o .pre-commit-config.yaml (Guarda contra vazamento de segredos)..."
cat << 'EOF' > .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: check-added-large-files
      - id: detect-private-key
      - id: check-merge-conflict
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.2
    hooks:
      - id: gitleaks
EOF

echo "==> A criar src/core/config.py (Validação Pydantic de Variáveis)..."
cat << 'EOF' > src/core/config.py
from functools import lru_cache
from typing import List
from pydantic import MySQLDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "App PCN Advogadas"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "production"

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    BACKEND_CORS_ORIGINS: List[str] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v

    DATABASE_URL: MySQLDsn

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
EOF

echo "==> A criar src/core/database.py (Conexão Assíncrona MySQL)..."
cat << 'EOF' > src/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from core.config import settings

engine = create_async_engine(
    str(settings.DATABASE_URL),
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session
EOF

echo "==> A criar src/main.py (Entrypoint FastAPI & Middlewares de Segurança)..."
cat << 'EOF' > src/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/healthz", tags=["Saúde do Sistema"])
async def health_check():
    return {"status": "online", "app": settings.PROJECT_NAME, "environment": settings.ENVIRONMENT}
EOF

echo "==> Ficheiro init em branco para os pacotes..."
touch src/__init__.py
touch src/core/__init__.py
touch src/models/__init__.py
touch src/schemas/__init__.py
touch src/repositories/__init__.py
touch src/services/__init__.py
touch src/api/__init__.py
touch src/api/v1/__init__.py

echo "==> Setup concluído com sucesso na pasta '$PROJECT_NAME'!"
echo "Podes abrir esta pasta diretamente no Antigravity."