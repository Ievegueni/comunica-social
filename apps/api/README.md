# @comunica/api

Backend API do COMUNICA Social. Fastify + TypeScript + Prisma.

## Estrutura

```
src/
├── config/        # Validacao de env vars (Zod)
├── plugins/       # Plugins Fastify (cors, helmet, jwt, rate-limit)
├── modules/       # Modulos por dominio
│   └── health/    # Health check endpoints
├── lib/           # Utilitarios (prisma, redis, logger)
├── workers/       # BullMQ workers
└── server.ts      # Entry point
```

## Endpoints

| Metodo | Path      | Descricao           |
| ------ | --------- | ------------------- |
| GET    | `/health` | Verifica DB + Redis |
| GET    | `/ready`  | Readiness check     |

## Variaveis de ambiente

Ver `.env.example` para todas as variaveis necessarias.

## Scripts

```bash
pnpm dev          # Dev com hot-reload (tsx watch)
pnpm build        # Compila TypeScript
pnpm start        # Inicia em producao
pnpm db:migrate   # Corre migrations
pnpm db:seed      # Seed da BD
pnpm db:studio    # Prisma Studio
pnpm test         # Testes
```
