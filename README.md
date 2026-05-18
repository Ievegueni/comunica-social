# COMUNICA Social

Plataforma SaaS multi-tenant de gestao e automacao de redes sociais (Facebook + Instagram) para o mercado PALOP.

## Stack

- **Backend:** Node.js 20, Fastify, Prisma, PostgreSQL 16, Redis 7, BullMQ
- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, Zustand, TanStack Query
- **Infra:** Railway, Cloudinary, Anthropic Claude API, Meta Graph API

## Pre-requisitos

- Node.js 20+
- pnpm 9+
- PostgreSQL 16 (local ou Docker)
- Redis 7 (local ou Docker)

## Setup local

```bash
# 1. Clonar e instalar dependencias
git clone <repo-url>
cd comunica-social
pnpm install

# 2. Configurar variaveis de ambiente
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Editar apps/api/.env com as credenciais locais

# 3. Subir PostgreSQL e Redis (Docker)
docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=comunica_social postgres:16-alpine
docker run -d --name redis -p 6379:6379 redis:7-alpine

# 4. Criar tabelas e seed
pnpm db:migrate
pnpm db:seed

# 5. Iniciar dev
pnpm dev
```

A API corre em `http://localhost:3000` e o frontend em `http://localhost:5173`.

## Comandos

| Comando           | Descricao                                |
| ----------------- | ---------------------------------------- |
| `pnpm dev`        | Inicia API + Web em modo desenvolvimento |
| `pnpm build`      | Builda ambos os apps                     |
| `pnpm lint`       | Corre ESLint em todos os pacotes         |
| `pnpm test`       | Corre testes (vitest)                    |
| `pnpm db:migrate` | Corre migrations Prisma                  |
| `pnpm db:seed`    | Popula BD com dados de teste             |
| `pnpm db:studio`  | Abre Prisma Studio                       |

## Estrutura

```
comunica-social/
├── apps/
│   ├── api/          # Backend Fastify
│   └── web/          # Frontend React + Vite
├── packages/
│   └── shared/       # Types partilhados
├── .github/workflows/ # CI/CD
├── CLAUDE.md         # Especificacao tecnica completa
└── SPRINTS.md        # Plano de sprints
```

## Deploy

Deploy automatico via Railway. Ver [docs/deployment.md](docs/deployment.md) para guia completo.

## Documentacao

- [CLAUDE.md](CLAUDE.md) — Arquitetura, schema, integrações
- [SPRINTS.md](SPRINTS.md) — Plano de 12 sprints
- [docs/deployment.md](docs/deployment.md) — Guia de deploy Railway
