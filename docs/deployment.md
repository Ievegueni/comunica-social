# Guia de Deploy — Railway

## Visao geral

O COMUNICA Social e deployado no Railway com 4 servicos:

1. **api** — Backend Fastify (Dockerfile)
2. **web** — Frontend React (Dockerfile + nginx)
3. **PostgreSQL** — Plugin Railway
4. **Redis** — Plugin Railway

## Passo a passo

### 1. Criar projeto no Railway

1. Login em [railway.app](https://railway.app)
2. Criar novo projeto
3. Conectar ao repositorio GitHub

### 2. Adicionar servicos de base de dados

1. Clicar "New" > "Database" > "PostgreSQL"
2. Clicar "New" > "Database" > "Redis"

### 3. Criar servico API

1. Clicar "New" > "GitHub Repo" > selecionar repo
2. Em Settings:
   - Root Directory: `/` (usa Dockerfile na raiz)
   - Dockerfile Path: `apps/api/Dockerfile`
3. Em Variables, configurar:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<gerar com openssl rand -hex 32>
JWT_REFRESH_SECRET=<gerar com openssl rand -hex 32>
ENCRYPTION_KEY=<gerar com openssl rand -hex 32>
META_APP_ID=<do developers.facebook.com>
META_APP_SECRET=<do developers.facebook.com>
META_REDIRECT_URI=https://app.comunica.ao/auth/meta/callback
META_WEBHOOK_VERIFY_TOKEN=<gerar random>
CLOUDINARY_CLOUD_NAME=<do cloudinary.com>
CLOUDINARY_API_KEY=<do cloudinary.com>
CLOUDINARY_API_SECRET=<do cloudinary.com>
ANTHROPIC_API_KEY=<do console.anthropic.com>
APP_URL=https://app.comunica.ao
API_URL=https://api.comunica.ao
NODE_ENV=production
PORT=3000
```

4. Em Settings > Networking: gerar dominio ou adicionar `api.comunica.ao`

### 4. Criar servico Web

1. Clicar "New" > "GitHub Repo" > selecionar repo
2. Em Settings:
   - Dockerfile Path: `apps/web/Dockerfile`
3. Em Variables:

```
VITE_API_URL=https://api.comunica.ao
```

4. Em Settings > Networking: gerar dominio ou adicionar `app.comunica.ao`

### 5. Configurar dominios personalizados

1. No DNS do dominio `comunica.ao`, adicionar:
   - `api.comunica.ao` → CNAME para o dominio Railway da API
   - `app.comunica.ao` → CNAME para o dominio Railway do Web

### 6. Migrations em producao

Apos primeiro deploy:

```bash
# Via Railway CLI
railway run --service api -- npx prisma migrate deploy
railway run --service api -- npx tsx prisma/seed.ts
```

### 7. CI/CD automatico

O workflow `.github/workflows/deploy.yml` faz deploy automatico no push para `main`.

Requer secret no GitHub:

- `RAILWAY_TOKEN` — obter em Railway > Account Settings > Tokens

## Monitoramento

- Logs: Railway dashboard > servico > Logs
- Health check: `https://api.comunica.ao/health`
- Prisma Studio (local): `pnpm db:studio`
