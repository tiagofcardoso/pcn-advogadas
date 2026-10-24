# ⚖️ PCN Advogadas — Plataforma Integrada de Gestão Jurídica e Forense

> **Documento de Referência Técnica e Funcional (Contexto Completo do Projeto)**  
> Este `README.md` documenta de forma exaustiva a arquitetura, regras de negócio, modelos de dados, rotas da API, fluxos de autenticação/sessão e detalhes de implementação do monorepo **PCN Advogadas**, servindo como fonte única de verdade para programadores e sessões futuras de IA.

---

## 📑 Índice

1. [Visão Geral e Arquitetura](#-1-visão-geral-e-arquitetura)
2. [Mapa Completo do Repositório (Ficheiro a Ficheiro)](#-2-mapa-completo-do-repositório-ficheiro-a-ficheiro)
3. [Autenticação, Sessão, 2FA e Controlo de Acessos (RBAC)](#-3-autenticação-sessão-2fa-e-controlo-de-acessos-rbac)
4. [Regras de Negócio e Domínio Forense](#-4-regras-de-negócio-e-domínio-forense)
5. [Catálogo Completo de Endpoints da API (`/api/v1`)](#-5-catálogo-completo-de-endpoints-da-api-apiv1)
6. [Modelos da Base de Dados e Persistência](#-6-modelos-da-base-de-dados-e-persistência)
7. [Estado do Frontend e Chaves de `localStorage`](#-7-estado-do-frontend-e-chaves-de-localstorage)
8. [Variáveis de Ambiente e Configuração](#-8-variáveis-de-ambiente-e-configuração)
9. [Execução Local, CLI, Testes e Deploy](#-9-execução-local-cli-testes-e-deploy)

---

## 🏛️ 1. Visão Geral e Arquitetura

A plataforma **PCN Advogadas** é um sistema de gestão jurídica e controlo de honorários desenhado à medida para a sociedade de advogadas **PCN Advogadas** (Portugal).

### Stack Tecnológica

| Camada | Tecnologia | Detalhes Relevantes |
| :--- | :--- | :--- |
| **Frontend (`apps/web`)** | Next.js 16 (App Router) + React 19 + TypeScript | SPA/PWA responsiva concentrada em `src/app/page.tsx`, cliente HTTP tipado em `src/lib/api.ts`, estilos em Tailwind CSS 4 e ícones `lucide-react`. |
| **Backend (`apps/api`)** | Python 3.12+ + FastAPI + Pydantic v2 | Arquitetura em camadas (`api` → `services` → `repositories` → `models` / `domain`). |
| **Base de Dados** | SQLAlchemy 2.0 Async (`asyncpg` / `asyncmy` / `aiosqlite`) | Suporta PostgreSQL (`postgresql+asyncpg://`), MySQL/MariaDB (`mysql+asyncmy://`) e SQLite (`sqlite+aiosqlite://`). Pool com `pool_pre_ping=True` e reciclagem aos `280s`. |
| **Segurança** | JWT (`PyJWT`) + Argon2id (`pwdlib`) + TOTP (`pyotp`) + Fernet | Segredos TOTP encriptados em repouso (Fernet), anti-replay TOTP, anti-enumeração de utilizadores e rate limiting (`slowapi`). |
| **Exportação e Alertas** | `openpyxl` (Excel `.xlsx`) + SMTP / Resend API | Geração de Notas de Honorários em Excel (versão Cliente e versão Interna) e alertas de excesso de tempo por e-mail. |
| **Infraestrutura Produção** | Frontend: **Vercel** · Backend + DB: **Railway** | URL padrão da API no cliente: `https://remarkable-cat-production-2dc2.up.railway.app/api/v1` (sobreponível via `NEXT_PUBLIC_API_URL`). |

---

## 📂 2. Mapa Completo do Repositório (Ficheiro a Ficheiro)

```text
PDN/
├── docker-compose.yml                         # Stack local com MySQL 8.4 + API FastAPI
├── README.md                                  # Documentação técnica e funcional completa
│
├── apps/api/                                  # ── BACKEND (FastAPI) ──
│   ├── Dockerfile                             # Build multi-stage Python 3.12-slim (uvicorn c/ proxy-headers)
│   ├── pyproject.toml                         # Dependências, configuração pytest, ruff e mypy
│   ├── .env.example                           # Template de variáveis de ambiente
│   ├── src/pcn/
│   │   ├── main.py                            # Entrypoint FastAPI (`create_app`), CORS, handlers de erro, `/healthz` e `lifespan` (executa `run_seed()`)
│   │   ├── cli.py                             # Utilitário CLI (`create-admin`, `seed-task-types`, `set-role`)
│   │   ├── seed.py                            # População automática idempotente no boot (utilizadoras, Master TI e 5 categorias de serviço)
│   │   ├── core/
│   │   │   ├── config.py                      # `Settings` (Pydantic BaseSettings): validação estrita de segredos, JWT, DB pool, taxas fiscais, SMTP/Resend
│   │   │   ├── security.py                    # Argon2id, política de passwords, `JwtService` (ACCESS/MFA tokens, scopes FULL/SETUP), `TotpService` (Fernet + QR SVG)
│   │   │   ├── database.py                    # Engine assíncrono SQLAlchemy, conversão automática de URLs (`postgres://` -> `postgresql+asyncpg://`), `get_session`
│   │   │   ├── errors.py                      # Hierarquia de exceções (`AppError`, `AuthenticationError`, `PermissionDenied`, `NotFound`, `Conflict`, `BusinessRuleViolation`, `TokenError`)
│   │   │   ├── middleware.py                  # `RequestIdMiddleware` (`X-Request-ID`) e `SecurityHeadersMiddleware` (HSTS, X-Frame-Options, CSP, nosniff)
│   │   │   ├── rate_limit.py                  # Configuração do `slowapi` (`30/minute` nas rotas de autenticação)
│   │   │   ├── clock.py                       # Abstração de relógio UTC (`system_clock`) para facilitar testes determinísticos
│   │   │   └── logging.py                     # Logging estruturado com `request_id_ctx`
│   │   ├── domain/
│   │   │   ├── enums.py                       # `UserRole`, `TaskStatus`, `TaskAction`, `FeeNoteStatus`, `AuditAction`, `ADMIN_ROLES`
│   │   │   ├── task_state.py                  # Máquina de estados pura para transições de tarefas e permissões por ação
│   │   │   ├── deadlines.py                   # Calculadora de prazos processuais portugueses (CPC Art.º 138.º e 139.º, férias judiciais, feriados móveis/Páscoa e multa)
│   │   │   ├── fees.py                        # Cálculo decimal preciso de IVA (23%), retenção na fonte (23%) e total líquido
│   │   │   └── nif.py                         # Validação algorítmica de NIF português (módulo 11, 9 dígitos)
│   │   ├── models/
│   │   │   ├── base.py                        # `Base` declarativa SQLAlchemy + mixin `TimestampMixin` (`created_at`, `updated_at`)
│   │   │   ├── user.py                        # Tabelas `users` e `refresh_tokens`
│   │   │   ├── client.py                      # Tabela `clients`
│   │   │   ├── task.py                        # Tabelas `task_types` e `tasks`
│   │   │   ├── task_time_session.py           # Tabela `task_time_sessions` (sessões individuais de cronómetro)
│   │   │   ├── fee_note.py                    # Tabelas `fee_notes` e `fee_note_items`
│   │   │   ├── event.py                       # Tabela `events` (agenda/prazos)
│   │   │   └── audit_log.py                   # Tabela `audit_logs` (registo forense imutável de ações)
│   │   ├── repositories/                      # Camada de acesso a dados (queries SQLAlchemy isoladas por entidade)
│   │   ├── schemas/                           # Schemas Pydantic de entrada/saída (`auth`, `user`, `client`, `task`, `time_session`, `fee_note`, `event`, `metrics`)
│   │   ├── services/
│   │   │   ├── auth_service.py                # Login, bloqueio brute-force, verificação TOTP, onboarding 2FA, alteração de password, keepalive e refresh tokens
│   │   │   ├── user_service.py                # Gestão de utilizadoras, hierarquia `master` vs `admin_lawyer`, reset de password/2FA, desbloqueio e suspensão
│   │   │   ├── task_service.py                # CRUD de tarefas, quadros Kanban, atribuição/reivindicação, cronómetro (`start`/`pause`/`complete`/`sync`) e arquivo
│   │   │   ├── fee_note_service.py            # Criação/atualização de minutas de notas de honorários, preços por item e emissão definitiva
│   │   │   ├── email_service.py               # Envio de alertas de excesso de tempo (1h+) via Resend API (HTTPS) ou SMTP assíncrono
│   │   │   ├── deadline_service.py            # Serviço de cálculo de prazos CPC
│   │   │   └── metrics_service.py             # Agregação de métricas de produtividade, tempos e faturação
│   │   ├── exporters/
│   │   │   └── fee_note_xlsx.py               # Gerador Excel `.xlsx` com logotipo PCN (modo Cliente vs modo Controlo Interno com horas e advogada)
│   │   └── api/
│   │       ├── deps.py                        # Dependências FastAPI: `get_current_user`, `require_full_access`, `require_admin`, `require_master`
│   │       └── v1/                            # Routers REST: `auth.py`, `users.py`, `clients.py`, `tasks.py`, `timer.py`, `fee_notes.py`, `agenda.py`, `metrics.py`, `system.py`
│   └── tests/
│       ├── conftest.py                        # Configuração de ambiente de teste isolado (SQLite em memória/ficheiro temporário)
│       ├── test_security.py                   # Testes de regressão de segurança: onboarding, 2FA obrigatório, RBAC, lockout, hierarquia Master e CORS
│       ├── test_api.py                        # Testes de healthcheck e calculadora de prazos judiciais CPC
│       └── test_fee_note_excel.py             # Testes de geração e exportação de Notas de Honorários em Excel
│
└── apps/web/                                  # ── FRONTEND (Next.js 16 + React 19) ──
    ├── package.json                           # Scripts (`dev`, `build`, `start`, `lint`) e dependências
    ├── public/                                # Ícones PWA (`manifest.json`, `sw.js`, `logo_pcn.svg`, ícones 192/512)
    └── src/
        ├── app/
        │   ├── layout.tsx                     # Root layout, metadados PWA e fontes
        │   ├── globals.css                    # Estilos globais Tailwind CSS 4 e paleta visual PCN (`#92006F`, `#FAF8F5`, `#ECE6DB`)
        │   └── page.tsx                       # Aplicação principal completa (Login/2FA, Dashboard, Kanban, Cronómetro, Clientes, Prazos CPC, Notas de Honorários, Serviços €/h, Relatórios e Gestão de Utilizadoras)
        └── lib/
            ├── api.ts                         # Cliente HTTP (`apiFetch`) e funções para todos os endpoints da API
            ├── types.ts                       # Interfaces TypeScript (`Task`, `Client`, `UserProfile`, `ServiceCategory`, `ROLE_LABELS`, `isAdminRole`)
            ├── mockData.ts                    # Dados iniciais de fallback (`INITIAL_USERS`, `INITIAL_SERVICE_CATEGORIES`)
            └── platform.ts                    # Deteção de plataforma (iOS, Android, macOS, Windows) para exportação de calendários `.ics` / Google Calendar
```

---

## 🔐 3. Autenticação, Sessão, 2FA e Controlo de Acessos (RBAC)

### 3.1. Hierarquia de Perfis (`UserRole`)

Definida em [`apps/api/src/pcn/domain/enums.py`](apps/api/src/pcn/domain/enums.py) e [`apps/web/src/lib/types.ts`](apps/web/src/lib/types.ts):

1. **`master` (Equipa de TI / Administração de Sistema)**
   - Promovido automaticamente no arranque se o e-mail constar em `MASTER_EMAILS` (por defeito: `tiagofabriciocardoso@gmail.com`).
   - Tem todos os poderes da Direção e é o **único** perfil que pode criar outras contas `master` ou gerir/suspender/repor credenciais de contas `admin_lawyer` e `master`.
   - Ninguém pode suspender, despromover ou bloquear a própria conta.
2. **`admin_lawyer` (Direção — ex.: Dr.ª Patrícia)**
   - Acesso total à gestão do escritório: todos os quadros e tarefas, atribuição e reatribuição, eliminação e arquivo de tarefas, criação de clientes, configuração da Tabela de Serviços (`€/h`), emissão e exportação de Notas de Honorários, e gestão das contas de Advogadas Associadas (`lawyer`).
3. **`lawyer` (Advogada Associada — ex.: Dr.ª Inês, Dr.ª Sofia)**
   - Pode criar novas tarefas, puxar tarefas da Pool (`claim`), iniciar/pausar/concluir cronómetros e editar detalhes **apenas das suas próprias tarefas**.
   - Não tem acesso aos separadores de **Notas de Honorários**, **Tabela de Serviços (€/h)** nem **Gestão de Utilizadoras**, e não pode eliminar nem arquivar tarefas.

### 3.2. Fluxo Obrigatório de Primeiro Acesso (Onboarding)

Todas as contas novas (criadas pelo `seed.py` com a password inicial `Advogada2026!` ou criadas no painel de administração com password temporária gerada) iniciam com `must_change_password = True` e `is_totp_enabled = False`:

1. **Login Inicial (`POST /api/v1/auth/login`)**:
   - Enquanto `must_change_password == True` ou `is_totp_enabled == False`, a API emite um JWT com escopo restrito **`scp = "setup"`** (`TokenScope.SETUP`).
   - Qualquer tentativa de usar um token `setup` nas rotas normais da aplicação é bloqueada pela dependência `require_full_access` com `HTTP 403` (`code: "setup_required"`).
2. **Definição de Palavra-Passe Pessoal (`POST /api/v1/auth/change-password`)**:
   - Política obrigatória (`validate_password_policy`): entre **12 e 128 caracteres**, exigindo pelo menos uma letra minúscula, uma maiúscula, um algarismo e um símbolo especial, e diferente da senha atual.
3. **Configuração de 2FA / TOTP (`POST /api/v1/auth/2fa/setup` e `/auth/2fa/verify`)**:
   - Gera segredo Base32 encriptado na base de dados com **Fernet (`TOTP_ENCRYPTION_KEY`)** e devolve um QR Code SVG (`data:image/svg+xml;base64,...`) compatível com Google Authenticator / Microsoft Authenticator / Authy.
   - Após confirmar o primeiro código de 6 dígitos, ativa `is_totp_enabled = True`, guarda o time-step em `totp_last_step` (proteção anti-replay) e emite o token definitivo com **`scp = "full"`** (`TokenScope.FULL`).
4. **Logins Seguintes**:
   - `POST /api/v1/auth/login` valida a password e devolve `requires_2fa: true` com um `mfa_token` temporário (válido por **5 minutos**).
   - `POST /api/v1/auth/2fa/verify-login` valida o código TOTP (janela `±1` step de 30s, rejeitando steps `<= totp_last_step`) e emite o `access_token` completo.

### 3.3. Regra de Duração da Sessão e Fecho de Janela

Implementada em [`apps/web/src/app/page.tsx`](apps/web/src/app/page.tsx) e [`apps/api/src/pcn/core/config.py`](apps/api/src/pcn/core/config.py):

- **Enquanto a janela/ecrã está aberta (`document.visibilityState !== "hidden"`)**:
  - A sessão **nunca expira por tempo fixo** durante o trabalho.
  - Um verificador a cada **5 segundos** desliza continuamente a marca `pcn_session_expiry` no `localStorage` para `Date.now() + 1 hora` (`60 * 60 * 1000` ms).
  - A cada **15 minutos** com a janela aberta, o frontend chama `POST /api/v1/auth/keepalive` (`keepaliveTokenApi`) para renovar silenciosamente o `access_token` JWT.
- **Quando a janela/separador é fechada ou minimizada (`beforeunload`, `pagehide`, `visibilitychange -> hidden`)**:
  - O frontend grava `pcn_session_expiry = Date.now() + 1 hora` e deixa de deslizar o prazo enquanto estiver fechada/oculta.
  - **Se reabrir em menos de 1 hora (`<= 60 min`)**: a sessão é restaurada automaticamente sem pedir novo login e o token JWT é renovado via `/auth/keepalive`.
  - **Se ficar fechada por mais de 1 hora (`> 60 min`)**: ao reabrir ou focar a janela, a sessão é terminada (`handleLogout`) e é pedido novo login.
- **No Backend**:
  - `ACCESS_TOKEN_EXPIRE_MINUTES` tem o valor padrão de **1440 minutos (24 horas)** (configurável até 10080 min / 7 dias).

### 3.4. Proteção Brute-Force e Bloqueio de Conta

- Após **5 tentativas falhadas** (`MAX_LOGIN_ATTEMPTS = 5`) na password ou no código 2FA, a conta fica bloqueada durante **15 minutos** (`LOCKOUT_MINUTES = 15`, campo `locked_until`), rejeitando mesmo a password certa até o tempo expirar ou a Direção/Master desbloquear manualmente em `POST /api/v1/users/{id}/unlock`.

---

## ⚖️ 4. Regras de Negócio e Domínio Forense

### 4.1. Ciclo de Vida e Máquina de Estados de Tarefas

Definido em [`apps/api/src/pcn/domain/task_state.py`](apps/api/src/pcn/domain/task_state.py):

- **Estados (`TaskStatus`)**:
  - `backlog`: Privado do quadro da Direção.
  - `pool`: Publicado na Pool partilhada do escritório (sem advogada atribuída).
  - `assigned`: Atribuída a uma advogada, pronta a iniciar.
  - `in_progress`: Cronómetro em andamento.
  - `paused`: Cronómetro pausado.
  - `completed`: Tarefa concluída (pronta para constar em Nota de Honorários).
  - `archived`: Arquivada (oculta do quadro ativo, consultável no separador *Tarefas Arquivadas*).

### 4.2. Cronómetro em Tempo Real e Alerta de Excesso de Tempo (1h+)

- **Sincronização Híbrida**:
  - O tempo decorrido é incrementado ao segundo no cliente (`pcn_running_timers` no `localStorage`) e sincronizado com o servidor ao iniciar (`/timer/{id}/start`), pausar (`/timer/{id}/pause`), concluir (`/timer/{id}/complete`), editar manualmente ou fechar a sessão (`/timer/sync` com `keepalive: true`).
  - As funções de pausa e conclusão aceitam `?client_duration_seconds=` para garantir que o servidor nunca perde tempo acumulado localmente caso tenha havido perda momentânea de rede (`max(server_seconds, client_duration_seconds)`).
- **Alerta Automático de Horas (`overtimeAlert`)**:
  - Sempre que uma tarefa em andamento atinge um múltiplo de **1 hora (3600s, 7200s, ...)**, a aplicação abre um modal de alerta no ecrã (persistido em `pcn_overtime_alert` e `pcn_overtime_thresholds`) e dispara `POST /api/v1/tasks/{id}/notify-overtime`, que envia um e-mail automático para a advogada responsável (via Resend API ou SMTP).

### 4.3. Calculadora de Prazos Processuais Portugueses (Art.º 138.º e 139.º do CPC)

Implementada em [`apps/api/src/pcn/domain/deadlines.py`](apps/api/src/pcn/domain/deadlines.py):

- **Contagem Contínua com Suspensão nas Férias Judiciais** (Art.º 138.º n.º 1 do CPC):
  - O prazo começa a correr no dia seguinte à notificação (`start_date + 1 day`).
  - Se o processo **não for urgente** (`is_urgent = False`), a contagem suspende-se durante as **Férias Judiciais Portuguesas**:
    - **Natal**: 22 de dezembro a 3 de janeiro;
    - **Páscoa**: Domingo de Ramos até Segunda-feira de Páscoa (calculado dinamicamente pelo algoritmo de Butcher-Meeus);
    - **Verão**: 16 de julho a 31 de agosto.
  - Se o último dia do prazo calhar num sábado, domingo, feriado nacional (fixo ou móvel: Sexta-feira Santa, Páscoa, Corpo de Deus) ou dia de férias judiciais (em processos não urgentes), transfere-se para o **primeiro dia útil seguinte** (Art.º 138.º n.º 2 do CPC).
- **Multa Processual nos 3 Dias Úteis Subsequentes** (Art.º 139.º n.º 5 do CPC):
  - Calcula automaticamente as datas exatas do **1.º, 2.º e 3.º dias úteis seguintes** ao termo do prazo para prática do ato com multa.

### 4.4. Faturação Horária, Tabela de Serviços (€/h) e Notas de Honorários

- **5 Categorias Oficiais Semeadas no Arranque (`seed.py`)**:
  1. `Certidões e Registos` — **90,00 €/h**
  2. `Peças Processuais` — **150,00 €/h**
  3. `Consultoria e Reuniões` — **120,00 €/h**
  4. `Audiências e Julgamentos` — **180,00 €/h**
  5. `Análise Documental` — **110,00 €/h**
  *(A Direção pode criar novas categorias, alterar valores `€/h` ou cores no separador **Tabela de Serviços (€/h)**).*
- **Cálculo de Honorários e Avenças**:
  - Suporta arredondamento opcional de faturação em blocos de **0 min (exato)**, **6 min (1/10h)** ou **15 min (1/4h)**, além de horas de avença mensal (*retainer*) por cliente e ajuste manual de valor por tarefa.
- **Impostos e Retenção (Portugal)**:
  - **IVA**: `23%` (`DEFAULT_VAT_RATE = 0.23`).
  - **Retenção na Fonte (IRS/IRC)**: `23%` (`DEFAULT_WITHHOLDING_RATE = 0.23`, ativável/desativável por cliente).
- **Exportação Excel (`.xlsx`) em Duas Versões ([`fee_note_xlsx.py`](apps/api/src/pcn/exporters/fee_note_xlsx.py))**:
  - **Versão Cliente (`internal=false`)**: Apresenta cabeçalho institucional com logotipo da PCN Advogadas, dados do cliente, lista de atos/tarefas e valores sem expor tempos internos nem nomes das advogadas.
  - **Versão Controlo Interno (`internal=true`)**: Inclui colunas adicionais com a advogada responsável e duração detalhada (`HH:MM:SS`) de cada tarefa.

---

## 🌐 5. Catálogo Completo de Endpoints da API (`/api/v1`)

### Autenticação (`/api/v1/auth`)
| Método | Rota | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Público | Valida email/password; devolve `access_token` (se em setup) ou `mfa_token` (se 2FA ativo). |
| `POST` | `/auth/2fa/verify-login` | Público (`mfa_token`) | Valida código TOTP de 6 dígitos no login e emite `access_token` + cookie `pcn_refresh`. |
| `POST` | `/auth/keepalive` | Autenticado (`setup`/`full`) | Emite um novo `access_token` renovado para manter a sessão ativa enquanto a janela está aberta. |
| `POST` | `/auth/refresh` | Cookie `pcn_refresh` | Rotação de Refresh Token com deteção de reutilização (revoga toda a família em caso de replay). |
| `POST` | `/auth/logout` | Autenticado / Cookie | Revoga a família de refresh tokens na BD e limpa o cookie. |
| `GET` | `/auth/me` | Autenticado | Devolve o perfil da utilizadora autenticada. |
| `POST` | `/auth/change-password` | Autenticado (`setup`/`full`) | Define nova palavra-passe pessoal, revoga sessões anteriores e emite novo token. |
| `POST` | `/auth/2fa/setup` | Autenticado (`setup`/`full`) | Gera segredo TOTP encriptado e devolve URI + QR Code em SVG (`qr_svg_data_uri`). |
| `POST` | `/auth/2fa/verify` | Autenticado (`setup`/`full`) | Confirma o primeiro código TOTP, ativa 2FA na conta e emite token com escopo `full`. |

### Gestão de Utilizadoras (`/api/v1/users`)
| Método | Rota | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/users` | `full` | Lista utilizadoras da sociedade (usado nos seletores de tarefas e no portal Admin). |
| `POST` | `/users` | `admin` / `master` | Cria nova utilizadora com password temporária segura (`must_change_password=True`). |
| `PATCH` | `/users/{user_id}` | `admin` / `master` | Atualiza nome, perfil (`role`) ou estado ativo/suspenso (`is_active`). |
| `POST` | `/users/{user_id}/unlock` | `admin` / `master` | Limpa `locked_until` e `failed_login_attempts` de uma conta bloqueada. |
| `POST` | `/users/{user_id}/reset-mfa` | `admin` / `master` | Desativa o 2FA da utilizadora para permitir configurar um novo telemóvel no próximo login. |
| `POST` | `/users/{user_id}/reset-password` | `admin` / `master` | Gera e devolve uma nova password temporária e força `must_change_password=True`. |

### Clientes e Tipos de Tarefa (`/api/v1/clients`, `/api/v1/task-types`)
| Método | Rota | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/clients` | `full` | Lista clientes ativos (suporta pesquisa `?q=`). |
| `POST` | `/clients` | `admin` | Cria novo cliente (valida NIF português se preenchido). |
| `PATCH` | `/clients/{client_id}` | `admin` | Atualiza dados do cliente. |
| `DELETE` | `/clients/{client_id}` | `admin` | Desativa cliente (soft-delete `is_active=False`). |
| `GET` | `/task-types` | `full` | Lista categorias de serviços jurídicos e respetivos valores `€/h`. |
| `POST` | `/task-types` | `admin` | Cria nova categoria de serviço com `hourly_rate` e `color`. |
| `PATCH` | `/task-types/{type_id}` | `admin` | Atualiza nome, descrição, `hourly_rate` ou cor de uma categoria. |
| `DELETE` | `/task-types/{type_id}` | `admin` | Desativa/remove categoria de serviço. |

### Tarefas e Quadros Kanban (`/api/v1/tasks`)
| Método | Rota | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/tasks/boards/direction` | `full` | Lista todas as tarefas do escritório com cliente, categoria e advogada. |
| `GET` | `/tasks/boards/pool` | `full` | Lista tarefas disponíveis na Pool (`status = pool`). |
| `GET` | `/tasks/boards/me` | `full` | Lista tarefas atribuídas à advogada autenticada. |
| `POST` | `/tasks` | `full` | Cria tarefa (Associadas só podem criar para si próprias ou para a Pool). |
| `PATCH` | `/tasks/{task_id}` | `full` (dona) / `admin` | Atualiza título, descrição, cliente, tipo, prazo, estado, duração ou honorários. |
| `POST` | `/tasks/{task_id}/assign` | `admin` | Atribui/reatribui tarefa a uma advogada ou devolve à Pool (`assigned_to: null`). |
| `POST` | `/tasks/{task_id}/claim` | `full` | Advogada reivindica uma tarefa da Pool para si. |
| `POST` | `/tasks/{task_id}/archive` | `admin` | Arquiva uma tarefa concluída (`status = archived`). |
| `POST` | `/tasks/{task_id}/restore` | `admin` | Restaura uma tarefa arquivada para `completed`. |
| `DELETE` | `/tasks/{task_id}` | `admin` | Elimina permanentemente uma tarefa (e sessões de tempo associadas) se não faturada. |
| `POST` | `/tasks/{task_id}/notify-overtime` | `full` (dona) / `admin` | Envia alerta por e-mail quando uma tarefa atinge 1h+ de execução contínua. |

### Cronómetro (`/api/v1/timer`)
| Método | Rota | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/timer/active` | `full` | Devolve a sessão de cronómetro atualmente ativa da utilizadora. |
| `POST` | `/timer/{task_id}/start` | `full` (dona) / `admin` | Inicia o cronómetro na tarefa indicada (`status = in_progress`). |
| `POST` | `/timer/{task_id}/pause` | `full` (dona) / `admin` | Pausa o cronómetro e consolida os segundos (`?client_duration_seconds=`). |
| `POST` | `/timer/{task_id}/complete` | `full` (dona) / `admin` | Para o cronómetro e marca a tarefa como `completed`. |
| `POST` | `/timer/sync` | `full` | Sincroniza em lote os tempos (`total_duration_seconds`) das tarefas em curso. |

### Notas de Honorários, Prazos e Métricas (`/api/v1/fee-notes`, `/api/v1/agenda`, `/api/v1/metrics`)
| Método | Rota | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `GET` | `/fee-notes` | `admin` | Lista Notas de Honorários com itens (filtrável por `?client_id=`). |
| `GET` | `/fee-notes/unbilled-tasks` | `admin` | Lista tarefas concluídas e ainda não faturadas de um cliente. |
| `POST` | `/fee-notes/drafts` | `admin` | Cria ou atualiza rascunho de Nota de Honorários para um cliente. |
| `PATCH` | `/fee-notes/{note_id}/price-item` | `admin` | Atualiza o preço individual de uma tarefa na Nota de Honorários. |
| `POST` | `/fee-notes/{note_id}/issue` | `admin` | Emite definitivamente a Nota de Honorários (`NH-AAAA-XXXX`). |
| `GET` | `/fee-notes/{note_id}/export-excel` | `admin` | Exporta ficheiro `.xlsx` (`?internal=false` para Cliente, `?internal=true` para Interno). |
| `POST` | `/agenda/calculate-deadline` | `full` | Calcula prazo judicial CPC (data final, dias suspensos em férias e 3 dias de multa). |
| `GET` | `/metrics/summary` | `full` | Resumo analítico de horas, tarefas e honorários (com filtro `?q=`). |

---

## 🗄️ 6. Modelos da Base de Dados e Persistência

As tabelas são criadas automaticamente no arranque da API por `Base.metadata.create_all` em [`apps/api/src/pcn/seed.py`](apps/api/src/pcn/seed.py):

1. **`users`**: `id`, `name`, `email` (único), `password_hash`, `role` (`master`/`admin_lawyer`/`lawyer`), `is_active`, `must_change_password`, `totp_secret_enc` (Fernet), `is_totp_enabled`, `totp_last_step`, `failed_login_attempts`, `locked_until`, `last_login_at`.
2. **`refresh_tokens`**: `id`, `user_id` (FK), `token_hash` (SHA-256), `family_id`, `expires_at`, `revoked_at`, `created_ip`.
3. **`clients`**: `id`, `name`, `nif`, `email`, `phone`, `address`, `process_reference`, `notes`, `is_active`.
4. **`task_types`**: `id`, `name` (único), `description`, `hourly_rate` (`Numeric(10,2)`), `default_billable`, `color`, `is_active`.
5. **`tasks`**: `id`, `client_id` (FK), `task_type_id` (FK), `title`, `description`, `status`, `created_by` (FK), `assigned_to` (FK opcional), `due_date`, `is_urgent_deadline`, `total_duration_seconds`, `fee_amount`, `is_billed`, `completed_at`, `archived_at`.
6. **`task_time_sessions`**: `id`, `task_id` (FK), `user_id` (FK), `started_at`, `ended_at`, `duration_seconds`, `is_manual_adjustment`, `notes`.
7. **`fee_notes`** & **`fee_note_items`**: Cabeçalho da nota (`reference_code`, `client_id`, `status`, `subtotal`, `vat_rate`, `vat_amount`, `withholding_rate`, `withholding_amount`, `total_amount`) e linhas por tarefa (`task_id`, `description`, `duration_seconds`, `amount`).
8. **`events`**: Eventos de agenda e prazos (`title`, `event_type`, `start_at`, `end_at`, `client_id`, `task_id`, `is_urgent`).
9. **`audit_logs`**: Registo forense de todas as ações sensíveis (`actor_id`, `action`, `entity`, `entity_id`, `ip_address`, `metadata_json`, `created_at`).

---

## 💾 7. Estado do Frontend e Chaves de `localStorage`

O frontend ([`apps/web/src/app/page.tsx`](apps/web/src/app/page.tsx)) utiliza as seguintes chaves no `localStorage` do navegador:

| Chave `localStorage` | Finalidade |
| :--- | :--- |
| `pcn_session_token` | JWT `access_token` da sessão ativa. |
| `pcn_session_expiry` | Timestamp (ms) de expiração da sessão (desliza para `agora + 1h` enquanto o ecrã está aberto; fixa-se em `fecho + 1h` quando a janela fecha). |
| `pcn_session_user` | Objeto JSON `UserProfile` (`id`, `name`, `role`, `email`) da utilizadora autenticada. |
| `pcn_running_timers` | Mapa `{ [taskId]: { seconds, updatedAt } }` para recuperação exata de cronómetros em curso mesmo após refresh ou perda de rede. |
| `pcn_overtime_alert` | Estado persistido do popup de alerta de 1h+ de execução contínua. |
| `pcn_overtime_thresholds` | Próximo limiar em segundos (`3600`, `7200`, ...) para disparo de alerta por tarefa. |
| `pcn_service_categories` | Cache local das categorias de serviço e respetivos valores `€/h`. |
| `pcn_client_hourly_rates` | Valores-hora personalizados por cliente (sobrepõem a taxa padrão se definidos). |
| `pcn_client_retainer_hours` | Horas de avença mensal (*retainer*) incluídas por cliente. |
| `pcn_billing_rounding` | Regra de arredondamento de tempo na faturação (`"0"`, `"6"` ou `"15"` minutos). |

---

## ⚙️ 8. Variáveis de Ambiente e Configuração

### Backend (`apps/api/.env`)

| Variável | Obrigatória? | Valor Padrão / Exemplo | Descrição |
| :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | Não | `production` (`development` / `test`) | Define o modo de execução (em `production`, oculta `/docs` e exige `BACKEND_CORS_ORIGINS`). |
| `DATABASE_URL` | Não | `sqlite+aiosqlite:///./pcn_data.db` | URL de ligação à BD (`postgresql://...`, `mysql://...` ou `sqlite+aiosqlite://...`). |
| `SECRET_KEY` | **Sim** | Hex aleatório `>= 32` chars | Chave de assinatura dos tokens JWT (rejeita segredos fracos ou conhecidos). |
| `TOTP_ENCRYPTION_KEY` | **Sim** | `Fernet.generate_key().decode()` | Chave Fernet para encriptar os segredos 2FA na base de dados. |
| `BACKEND_CORS_ORIGINS` | **Sim (Prod)** | `https://seu-dominio.vercel.app` | Lista separada por vírgulas de origens permitidas no CORS (proibido `*`). |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Não | `1440` (24 horas) | Tempo de vida de cada JWT emitido (renovado automaticamente via `/auth/keepalive`). |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Não | `7` | Validade em dias do cookie de refresh token. |
| `MAX_LOGIN_ATTEMPTS` | Não | `5` | Tentativas falhadas antes de bloquear temporariamente a conta. |
| `LOCKOUT_MINUTES` | Não | `15` | Minutos de bloqueio automático após atingir `MAX_LOGIN_ATTEMPTS`. |
| `MASTER_EMAILS` | Não | `tiagofabriciocardoso@gmail.com` | E-mails separados por vírgula promovidos ao perfil `master` no arranque. |
| `RESEND_API_KEY` | Não | `re_...` | Chave da API Resend para envio de e-mails de alerta de tempo (recomendado em cloud). |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Não | — | Credenciais SMTP alternativas caso `RESEND_API_KEY` não esteja definida. |

### Frontend (`apps/web/.env.local`)

| Variável | Valor Padrão | Descrição |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://remarkable-cat-production-2dc2.up.railway.app/api/v1` | URL base da API FastAPI consumida pelo cliente web. |

---

## 🚀 9. Execução Local, CLI, Testes e Deploy

### Executar Testes e Verificação de Tipos

```powershell
# 1. Testes automatizados do Backend (pytest — 12 testes de segurança, API e Excel)
cd apps/api
.\.venv\Scripts\pytest -q

# 2. Verificação estática de TypeScript no Frontend
cd apps/web
npx tsc --noEmit
```

### Executar Localmente em Desenvolvimento

```powershell
# Terminal 1 — Backend FastAPI (porta 8000)
cd apps/api
.\.venv\Scripts\uvicorn pcn.main:app --reload --port 8000

# Terminal 2 — Frontend Next.js (porta 3000)
cd apps/web
npm run dev
```

### Comandos Administrativos CLI (`apps/api/src/pcn/cli.py`)

```powershell
cd apps/api
# Criar ou promover conta de administradora:
.\.venv\Scripts\python -m pcn.cli create-admin --name "Dr.ª Patrícia" --email "patricia@pcnadvogadas.pt"

# Semear tipos de tarefa e valores €/h padrão:
.\.venv\Scripts\python -m pcn.cli seed-task-types

# Alterar perfil de uma utilizadora (master | admin_lawyer | lawyer):
.\.venv\Scripts\python -m pcn.cli set-role --email "ines@pcnadvogadas.pt" --role "admin_lawyer"
```

---

## 📄 Licença

Propriedade exclusiva da **PCN Advogadas**. Todos os direitos reservados.
