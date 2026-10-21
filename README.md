# ⚖️ PCN Advogadas — Plataforma de Gestão Jurídica Integrada

Plataforma completa de gestão de escritório de advocacia desenvolvida sob medida para a sociedade **PCN Advogadas**. A solução integra gestão de tarefas jurídicas em quadro Kanban, controlo de tempos (*time tracking*) em tempo real, acompanhamento de prazos e audiências na agenda, geração e exportação de Notas de Honorários para Excel e controlo de acessos robusto com autenticação de dois fatores (2FA/TOTP).

---

## 📑 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades Principais](#-funcionalidades-principais)
- [Arquitetura & Stack Tecnológica](#-arquitetura--stack-tecnológica)
- [Estrutura do Repositório (Monorepo)](#-estrutura-do-repositório-monorepo)
- [Pré-requisitos](#-pré-requisitos)
- [Configuração Rápida com Docker](#-configuração-rápida-com-docker)
- [Instalação e Execução Local (Sem Docker)](#-instalação-e-execução-local-sem-docker)
  - [1. Backend (FastAPI)](#1-backend-fastapi)
  - [2. Frontend (Next.js)](#2-frontend-nextjs)
- [Linha de Comandos (CLI) & Gestão Inicial](#-linha-de-comandos-cli--gestão-inicial)
- [Segurança & Boas Práticas](#-segurança--boas-práticas)
- [Testes e Qualidade de Código](#-testes-e-qualidade-de-código)

---

## 🏛️ Visão Geral

A aplicação foi concebida para otimizar a rotina operacional do escritório de advocacia:
- **Fluxo Visual de Processos**: Cada tarefa ou peça processual progride de forma transparente entre estados.
- **Rigor na Faturação Horária**: Registo exato do tempo despendido em cada cliente ou processo através de cronómetro incorporado.
- **Conformidade Fiscal Portuguesa**: Cálculo automático de honorários com retenção na fonte (IRS/IRC) e IVA às taxas em vigor.
- **Proteção Rigorosa de Dados Jurídicos**: Segurança reforçada com encriptação de segredos em repouso e 2FA mandatório.

---

## ✨ Funcionalidades Principais

### 1. 📋 Quadro Kanban Jurídico
- Fluxo de trabalho em 4 colunas: **Pendente**, **Em Curso**, **Em Validação** e **Concluído**.
- Atribuição de tarefas a advogadas e associação a clientes.
- Categorização visual por tipo de ato (Certidões, Peças Processuais, Audiências, Consultoria, Análise Documental).
- Filtros rápidos por cliente, advogada responsável e pesquisa textual.
- Arquivo e restauro de tarefas concluídas.

### 2. ⏱️ Controlo de Tempos (*Time Tracking*)
- Cronómetro integrado diretamente nos cards de tarefa e na barra superior.
- Registo detalhado de sessões de tempo com histórico auditável.
- Deteção e alerta visual de desvios e horas excedidas.
- Sincronização automática entre dispositivos.

### 3. 💶 Notas de Honorários & Faturação Forense
- Geração automática de minutas de Notas de Honorários com base no tempo registado e valor-hora configurado por serviço.
- Aplicação automática de taxas de **IVA (23%)** e **Retenção na Fonte (23%)**.
- Numeração sequencial formal (ex.: `NH-2026-0001`).
- Exportação profissional em **Microsoft Excel (`.xlsx`)** formatada com identidade visual e logotipo da sociedade.

### 4. 📅 Agenda & Gestão de Prazos Processuais
- Visualização e controlo de prazos judiciais com cálculo automático de contagens.
- Registo de diligências, audiências e reuniões com clientes.
- Notificações de proximidade de prazos fatais.

### 5. 👥 Gestão de Clientes e Pastas
- Ficha de entidade individual e empresarial (NIF, morada, contactos, observações confidenciais).
- Acesso rápido a todo o histórico de tarefas, sessões de tempo e notas de honorários associadas ao cliente.

### 6. 🔐 Segurança, Perfis e 2FA (MFA)
- **Níveis de Acesso (RBAC)**:
  - `master`: Administração técnica e IT.
  - `admin_lawyer`: Advogada Titular / Direção (gestão total, utilizadores, valores-hora e relatórios globais).
  - `lawyer`: Advogada Associada / Estagiária (gestão das suas próprias tarefas, tempos e clientes).
- **2FA Obrigatório (TOTP)**: Compatível com Google Authenticator, Microsoft Authenticator e 1Password.
- **Políticas de Palavra-Passe**: Obrigatoriedade de troca no primeiro acesso e algoritmo de hashing **Argon2id**.
- **Bloqueio contra Brute-Force**: Bloqueio temporário de conta após 5 tentativas consecutivas falhadas.

---

## 🛠️ Arquitetura & Stack Tecnológica

### Backend (`apps/api`)
- **Linguagem**: Python 3.12+
- **Framework Web**: [FastAPI](https://fastapi.tiangolo.com/) com validação via [Pydantic v2](https://docs.pydantic.dev/)
- **ORM & BD**: [SQLAlchemy 2.0 (AsyncIO)](https://www.sqlalchemy.org/) com drivers `asyncmy` (MySQL 8.4) e `aiosqlite` (desenvolvimento/testes)
- **Autenticação**: JWT (Access Token curto + Refresh Token com rotação segura em cookies HTTP-Only), `pwdlib` (Argon2id), `pyotp` (TOTP 2FA)
- **Criptografia em Repouso**: Chaves TOTP encriptadas com `cryptography` (Fernet)
- **Rate Limiting**: `slowapi`
- **Exportações**: `openpyxl` para geração de ficheiros Excel

### Frontend (`apps/web`)
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **UI Core**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Estilos**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Datas**: [date-fns](https://date-fns.org/) com suporte nativo a formato europeu (`DD/MM/AAAA`)

---

## 📂 Estrutura do Repositório (Monorepo)

```text
PDN/
├── apps/
│   ├── api/                      # Backend FastAPI
│   │   ├── src/pcn/
│   │   │   ├── api/v1/           # Endpoints REST (auth, clients, tasks, feenotes, timer, etc.)
│   │   │   ├── core/             # Configurações, segurança, database engine, middlewares
│   │   │   ├── domain/           # Enums e regras de negócio puras
│   │   │   ├── exporters/        # Gerador de relatórios e Excel
│   │   │   ├── models/           # Modelos ORM SQLAlchemy
│   │   │   ├── schemas/          # Schemas de validação Pydantic
│   │   │   ├── services/         # Camada de lógica de negócio
│   │   │   ├── cli.py            # CLI para gestão administrativa
│   │   │   └── seed.py           # População inicial de dados
│   │   ├── tests/                # Testes automatizados (pytest)
│   │   ├── pyproject.toml        # Dependências e ferramentas Python
│   │   └── .env.example          # Exemplo de configuração de variáveis
│   │
│   └── web/                      # Frontend Next.js
│       ├── src/
│       │   ├── app/              # Páginas e rotas da aplicação
│       │   └── lib/              # Cliente de API, tipagens e utilitários
│       ├── public/               # Ativos estáticos e Service Worker
│       └── package.json          # Dependências do frontend
│
├── docker-compose.yml            # Stack de desenvolvimento com MySQL e API
└── README.md                     # Este documento
```

---

## 📋 Pré-requisitos

Para executar o projeto localmente é necessário:
- **Git**
- **Docker & Docker Compose** (opção recomendada), **OU**
- **Python 3.12+** e gestor de pacotes (`uv` ou `pip`)
- **Node.js 20+** e `npm` (ou `pnpm` / `yarn`)

---

## 🐳 Configuração Rápida com Docker

A forma mais rápida de subir o ambiente de base de dados (MySQL 8.4) e a API:

1. **Configurar as variáveis de ambiente do backend**:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```
   *Edite o ficheiro `apps/api/.env` gerando uma chave `SECRET_KEY` e `TOTP_ENCRYPTION_KEY` válidas.*

2. **Iniciar os contentores**:
   ```bash
   docker compose up --build
   ```
   A API estará acessível em `http://127.0.0.1:8000` (com documentação Swagger em `/docs`).

3. **Executar o Frontend**:
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```
   Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 💻 Instalação e Execução Local (Sem Docker)

### 1. Backend (FastAPI)

1. Navegue até a pasta da API:
   ```bash
   cd apps/api
   ```

2. Crie e ative um ambiente virtual:
   ```bash
   python -m venv .venv
   # Windows (PowerShell):
   .venv\Scripts\Activate.ps1
   # Linux/macOS:
   source .venv/bin/activate
   ```

3. Instale as dependências:
   ```bash
   pip install -e ".[dev]"
   ```

4. Crie o ficheiro de configuração:
   ```bash
   cp .env.example .env
   ```

5. Gere as chaves de segurança necessárias no `.env`:
   ```bash
   # Gerar SECRET_KEY (JWT):
   python -c "import secrets; print(secrets.token_hex(32))"

   # Gerar TOTP_ENCRYPTION_KEY (Fernet):
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
   *Atualize também a `DATABASE_URL` (para SQLite local em desenvolvimento, pode usar `sqlite+aiosqlite:///../../pcn_data.db`).*

6. Inicie o servidor FastAPI:
   ```bash
   uvicorn pcn.main:create_app --factory --reload --port 8000
   ```

### 2. Frontend (Next.js)

1. Navegue até à pasta da aplicação web:
   ```bash
   cd apps/web
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure o ficheiro `.env.local` (se necessário):
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
   ```

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   Aceda a `http://localhost:3000`.

---

## ⌨️ Linha de Comandos (CLI) & Gestão Inicial

O backend inclui comandos utilitários para provisionamento e administração do sistema:

### Criar Conta de Administradora / Titular:
```bash
python -m pcn.cli create-admin --name "Dr.ª Patrícia" --email "patricia@pcnadvogadas.pt"
```
*O comando gera uma palavra-passe provisória segura que exigirá alteração e ativação de 2FA no primeiro login.*

### Semear Tipos de Tarefa e Honorários Padrão:
```bash
python -m pcn.cli seed-task-types
```

### Alterar Perfil de Utilizadora:
```bash
python -m pcn.cli set-role --email "usuario@exemplo.com" --role "admin_lawyer"
```

---

## 🔒 Segurança & Boas Práticas

- **Proteção OWASP**: Mitigação nativa contra CSRF, XSS, Session Hijacking e ataques de força bruta.
- **Tokens de Autenticação Seguros**: Tokens emitidos com vida curta (15 minutos), emparelhados com Refresh Tokens com rotação ativada e armazenamento em cookies HttpOnly com flag `SameSite=Lax/Strict`.
- **Hashing Robusto**: Todas as senhas utilizam **Argon2id**.
- **Criptografia em Repouso**: Segredos TOTP de duplo fator são encriptados na base de dados utilizando o padrão simétrico Fernet (AES-128 em modo CBC).
- **Rate Limiting**: Limites configurados nos endpoints sensíveis de autenticação (login, pedido de 2FA e recuperação).

---

## 🧪 Testes e Qualidade de Código

### Testes Automatizados (Backend)
Para executar a suite de testes unitários e de segurança:
```bash
cd apps/api
pytest
```

Para verificar a cobertura:
```bash
pytest --cov=pcn --cov-report=term-missing
```

### Linters & Verificação de Tipos
```bash
# Análise de estilo e código (Ruff)
ruff check src tests

# Verificação estática de tipos (Mypy)
mypy
```

---

## 📄 Licença

Este projeto é de uso restrito e propriedade exclusiva da **PCN Advogadas**. Todos os direitos reservados.
