# CLAUDE.md — COMUNICA Social

> Plataforma SaaS multi-tenant de gestão e automação de redes sociais (Facebook + Instagram), focada no mercado PALOP. Produto da **COMUNICA**.

---

## 1. Visão Geral

**COMUNICA Social** é uma plataforma de gestão de redes sociais que permite a empresas:

- Agendar e publicar conteúdo em Facebook e Instagram
- Gerar conteúdo automaticamente com IA (Claude API)
- Gerir biblioteca de mídia (imagens/vídeos)
- Receber e responder a comentários e mensagens diretas num inbox unificado
- Acompanhar métricas básicas de desempenho
- Operar fluxos de aprovação editorial (opcional)

**Mercado-alvo:** Angola, Moçambique, Cabo Verde, São Tomé e Príncipe, Guiné-Bissau (PALOP).

**Uso inicial:** Interno (Futurix + COMUNICA). Comercialização posterior.

---

## 2. Stack Técnica

### Backend

- **Runtime:** Node.js 20 LTS
- **Framework:** Fastify
- **ORM:** Prisma
- **BD:** PostgreSQL 16
- **Cache/Queue:** Redis 7 + BullMQ
- **Autenticação:** JWT (access + refresh) + bcrypt
- **Validação:** Zod
- **Encriptação de tokens:** AES-256-GCM (tokens Meta encriptados em repouso)

### Frontend

- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Componentes:** shadcn/ui
- **State:** Zustand + TanStack Query
- **Router:** React Router v6
- **Forms:** React Hook Form + Zod

### Infraestrutura

- **Hosting:** Railway (backend, frontend, PostgreSQL, Redis)
- **Storage de mídia:** Cloudinary
- **IA:** Anthropic Claude API
- **Webhooks externos:** Meta Graph Webhooks
- **Monitoring:** Railway logs + Sentry (opcional)

---

## 3. Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)        Railway                  │
│  - Dashboard                                             │
│  - Editor de posts                                       │
│  - Calendário editorial                                  │
│  - Biblioteca de mídia                                   │
│  - Inbox unificado                                       │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS / REST
                     ▼
┌──────────────────────────────────────────────────────────┐
│  Backend API (Fastify)          Railway                  │
│  - Auth & RBAC                                           │
│  - Tenants & Social Accounts                             │
│  - Posts CRUD + Scheduler                                │
│  - Inbox API                                             │
│  - Webhooks receiver (Meta)                              │
│  - AI generation service                                 │
└──────┬──────────────┬────────────┬──────────────┬────────┘
       │              │            │              │
       ▼              ▼            ▼              ▼
┌────────────┐ ┌─────────────┐ ┌──────────┐ ┌─────────────┐
│ PostgreSQL │ │ Redis       │ │Cloudinary│ │ Meta Graph  │
│ (Prisma)   │ │ + BullMQ    │ │ (mídia)  │ │ API + Hooks │
└────────────┘ └─────────────┘ └──────────┘ └─────────────┘
                     │
                     ▼
              ┌─────────────────┐
              │ Claude API      │
              │ (geração IA)    │
              └─────────────────┘
```

### Workers BullMQ

- `post-publisher` — publica posts agendados
- `token-refresher` — renova tokens Meta (60 em 60 dias)
- `metrics-collector` — coleta métricas dos posts publicados
- `ai-generator` — gera conteúdo via Claude API (jobs assíncronos)
- `webhook-processor` — processa webhooks Meta (comentários/DMs)

---

## 4. Multi-tenancy

- **Modelo:** Shared database, shared schema, com `tenantId` em todas as tabelas relevantes.
- **Isolamento:** Middleware Fastify injeta `tenantId` em cada request a partir do JWT.
- **Row-level security:** Aplicada via Prisma middleware (todos os queries filtrados por `tenantId`).

---

## 5. RBAC (Roles)

| Role       | Permissões                                                    |
| ---------- | ------------------------------------------------------------- |
| `OWNER`    | Tudo (1 por tenant, dono da conta)                            |
| `ADMIN`    | Gestão de utilizadores, contas sociais, configurações         |
| `EDITOR`   | Criar/editar posts, gerir biblioteca, ver analytics           |
| `APPROVER` | Aprovar posts criados por editores (quando aprovação está ON) |
| `VIEWER`   | Apenas leitura de posts, analytics, inbox                     |

---

## 6. Schema Prisma (resumo)

```prisma
// ============ TENANT & USERS ============

model Tenant {
  id                String   @id @default(cuid())
  name              String
  slug              String   @unique
  country           Country  // AO, MZ, CV, ST, GW
  approvalRequired  Boolean  @default(false)
  aiGenerationEnabled Boolean @default(false)
  status            TenantStatus @default(ACTIVE)
  createdAt         DateTime @default(now())

  users             User[]
  socialAccounts    SocialAccount[]
  posts             Post[]
  mediaAssets       MediaAsset[]
  mediaFolders      MediaFolder[]
  inboxItems        InboxItem[]
}

enum Country { AO MZ CV ST GW }
enum TenantStatus { ACTIVE SUSPENDED }

model User {
  id          String   @id @default(cuid())
  tenantId    String
  email       String   @unique
  passwordHash String
  name        String
  role        Role     @default(EDITOR)
  status      UserStatus @default(ACTIVE)
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  createdPosts Post[]  @relation("PostCreator")
  approvedPosts Post[] @relation("PostApprover")
}

enum Role { OWNER ADMIN EDITOR APPROVER VIEWER }
enum UserStatus { ACTIVE INVITED DISABLED }

// ============ SOCIAL ACCOUNTS ============

model SocialAccount {
  id                String   @id @default(cuid())
  tenantId          String
  platform          Platform
  externalId        String   // FB page_id ou IG user_id
  name              String   // nome da página/conta
  accessTokenEnc    String   // encriptado AES-256-GCM
  tokenExpiresAt    DateTime
  pageId            String?  // FB page id (necessário para IG)
  status            SocialAccountStatus @default(ACTIVE)
  connectedAt       DateTime @default(now())
  lastTokenRefresh  DateTime?

  tenant            Tenant   @relation(fields: [tenantId], references: [id])
  posts             Post[]
  inboxItems        InboxItem[]

  @@unique([tenantId, platform, externalId])
}

enum Platform { FACEBOOK INSTAGRAM }
enum SocialAccountStatus { ACTIVE TOKEN_EXPIRED REVOKED }

// ============ MEDIA LIBRARY ============

model MediaFolder {
  id         String   @id @default(cuid())
  tenantId   String
  name       String
  parentId   String?
  createdAt  DateTime @default(now())

  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  parent     MediaFolder? @relation("FolderTree", fields: [parentId], references: [id])
  children   MediaFolder[] @relation("FolderTree")
  assets     MediaAsset[]
}

model MediaAsset {
  id              String   @id @default(cuid())
  tenantId        String
  folderId        String?
  type            MediaType
  cloudinaryId    String   // public_id Cloudinary
  url             String
  thumbnailUrl    String?
  filename        String
  sizeBytes       Int
  width           Int?
  height          Int?
  durationSec     Int?     // para vídeos
  tags            String[]
  createdAt       DateTime @default(now())

  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  folder          MediaFolder? @relation(fields: [folderId], references: [id])
  postMedia       PostMedia[]
}

enum MediaType { IMAGE VIDEO }

// ============ POSTS ============

model Post {
  id              String   @id @default(cuid())
  tenantId        String
  socialAccountId String
  createdById     String
  approvedById    String?
  content         String   @db.Text
  scheduledFor    DateTime
  publishedAt     DateTime?
  externalPostId  String?  // id retornado pela Meta
  status          PostStatus @default(DRAFT)
  source          PostSource @default(MANUAL)
  errorMessage    String?
  retryCount      Int      @default(0)
  approvedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  socialAccount   SocialAccount @relation(fields: [socialAccountId], references: [id])
  createdBy       User     @relation("PostCreator", fields: [createdById], references: [id])
  approvedBy      User?    @relation("PostApprover", fields: [approvedById], references: [id])
  media           PostMedia[]
  metrics         PostMetric[]
}

enum PostStatus {
  DRAFT
  PENDING_APPROVAL
  SCHEDULED
  PUBLISHING
  PUBLISHED
  FAILED
  CANCELLED
}

enum PostSource { MANUAL AI_GENERATED }

model PostMedia {
  postId       String
  mediaAssetId String
  order        Int

  post         Post       @relation(fields: [postId], references: [id], onDelete: Cascade)
  mediaAsset   MediaAsset @relation(fields: [mediaAssetId], references: [id])

  @@id([postId, mediaAssetId])
}

// ============ METRICS ============

model PostMetric {
  id          String   @id @default(cuid())
  postId      String
  reach       Int      @default(0)
  impressions Int      @default(0)
  likes       Int      @default(0)
  comments    Int      @default(0)
  shares      Int      @default(0)
  saves       Int      @default(0)
  collectedAt DateTime @default(now())

  post        Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
}

// ============ INBOX ============

model InboxItem {
  id              String   @id @default(cuid())
  tenantId        String
  socialAccountId String
  type            InboxType
  externalId      String   // id do comentário/mensagem na Meta
  parentPostId    String?  // se for comentário num post
  fromUserId      String   // id externo do utilizador que enviou
  fromUserName    String
  content         String   @db.Text
  status          InboxStatus @default(UNREAD)
  receivedAt      DateTime
  repliedAt       DateTime?
  repliedById     String?

  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  socialAccount   SocialAccount @relation(fields: [socialAccountId], references: [id])
  replies         InboxReply[]

  @@index([tenantId, status])
  @@index([receivedAt])
}

enum InboxType { COMMENT_FB COMMENT_IG DM_MESSENGER DM_INSTAGRAM }
enum InboxStatus { UNREAD READ REPLIED ARCHIVED }

model InboxReply {
  id           String   @id @default(cuid())
  inboxItemId  String
  content      String   @db.Text
  sentById     String
  sentAt       DateTime @default(now())
  externalId   String?  // id retornado pela Meta

  inboxItem    InboxItem @relation(fields: [inboxItemId], references: [id])
}

// ============ AI GENERATION ============

model AIGenerationJob {
  id          String   @id @default(cuid())
  tenantId    String
  createdById String
  briefing    String   @db.Text
  tone        String
  count       Int      // quantos posts gerar
  status      AIJobStatus @default(PENDING)
  result      Json?    // array de posts gerados
  errorMessage String?
  createdAt   DateTime @default(now())
  completedAt DateTime?
}

enum AIJobStatus { PENDING PROCESSING COMPLETED FAILED }

// ============ AUDIT LOG ============

model AuditLog {
  id          String   @id @default(cuid())
  tenantId    String
  userId      String?
  action      String   // POST_CREATED, POST_PUBLISHED, ACCOUNT_CONNECTED, etc.
  entityType  String
  entityId    String
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([tenantId, createdAt])
}
```

---

## 7. Módulos Funcionais

### 7.1 Autenticação & Multi-tenant

- Registo de tenant (signup) → cria Tenant + User OWNER
- Login JWT (access 15min + refresh 7 dias)
- Convite de utilizadores por email (token de uso único)
- Recuperação de password

### 7.2 Conexão de Contas Meta

- OAuth flow com Meta (Facebook Login)
- Listagem de páginas FB e contas IG Business do utilizador
- Seleção de contas a conectar
- Armazenamento encriptado do token de longa duração
- Job de renovação automática de tokens (a cada 50 dias)

### 7.3 Editor de Posts

- Editor com preview por rede (FB vs IG)
- Upload de mídia direto ou seleção da biblioteca
- Caption + hashtags + primeira-comentário (IG)
- Agendamento (data/hora) ou publicação imediata
- Suporte multi-conta (publicar em várias contas simultaneamente)
- Draft auto-save

### 7.4 Calendário Editorial

- Vista mensal/semanal/diária
- Drag-and-drop para reagendar
- Filtros por conta, status, criador
- Indicadores visuais por status

### 7.5 Biblioteca de Mídia

- Estrutura de pastas hierárquica
- Upload single/múltiplo para Cloudinary
- Tags personalizadas
- Filtro por tipo, tags, dimensões, data
- Preview de imagens/vídeos
- Transformações automáticas por rede (square IG, landscape FB)

### 7.6 Geração IA (opcional)

- Toggle por tenant (`aiGenerationEnabled`)
- Form com briefing: tema, tom, público, n.º de posts
- Job assíncrono → Claude API gera N posts
- Resultado mostrado para revisão/edição
- Aprovar tudo / individualmente
- Agendamento automático após aprovação

### 7.7 Aprovação Editorial (opcional)

- Toggle por tenant (`approvalRequired`)
- Quando ON: Editor cria → status `PENDING_APPROVAL` → Approver revê → aprova/rejeita
- Notificações in-app + email
- Comentários de revisão

### 7.8 Publisher (Worker)

- BullMQ job agendado para `scheduledFor`
- Valida token antes de publicar
- Publica via Meta Graph API
- IG: fluxo 2-passos (criar container → publish)
- FB: publicação direta
- Retry 3x com backoff exponencial
- Guarda `externalPostId` para tracking

### 7.9 Inbox Unificado

- Webhooks Meta recebem eventos em tempo real
- Comentários FB, comentários IG, DMs Messenger, DMs Instagram
- Vista única com filtros por tipo, status, conta
- Resposta direta via Meta Graph API
- Marcar como lido/respondido/arquivado
- Notificações de novos itens

### 7.10 Analytics (MVP — Básico)

- Métricas por post: reach, impressions, likes, comments, shares
- Coleta automática 1h, 24h, 7d após publicação
- Vista de lista com sorting/filtros
- Export CSV
- **Pós-MVP:** dashboards, melhor horário, comparativos

---

## 8. Integração Meta Graph API

### Endpoints principais

**Autenticação:**

- `GET /oauth/authorize` (frontend redirect)
- `GET /v18.0/oauth/access_token` (exchange code)
- `GET /v18.0/{user-id}/accounts` (listar páginas)

**Publicação Facebook:**

- `POST /v18.0/{page-id}/feed` (texto + link)
- `POST /v18.0/{page-id}/photos` (foto)
- `POST /v18.0/{page-id}/videos` (vídeo)

**Publicação Instagram (2 passos):**

- `POST /v18.0/{ig-user-id}/media` (criar container)
- `POST /v18.0/{ig-user-id}/media_publish` (publicar)

**Métricas:**

- `GET /v18.0/{media-id}/insights` (IG)
- `GET /v18.0/{post-id}/insights` (FB)

**Engagement:**

- `GET /v18.0/{post-id}/comments`
- `POST /v18.0/{comment-id}/replies`
- `POST /v18.0/me/messages` (Messenger)

### Permissões Meta necessárias (App Review)

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `pages_manage_engagement`
- `pages_messaging`
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_comments`
- `instagram_manage_messages`
- `business_management`

### Webhooks Meta (subscrever)

- `page` → comments, messages, feed
- `instagram` → comments, messages, mentions

---

## 9. Variáveis de Ambiente

```bash
# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Auth
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ENCRYPTION_KEY=... # 32 bytes hex (AES-256)

# Meta
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=https://app.comunica.ao/auth/meta/callback
META_WEBHOOK_VERIFY_TOKEN=...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Anthropic
ANTHROPIC_API_KEY=...

# App
APP_URL=https://app.comunica.ao
API_URL=https://api.comunica.ao
NODE_ENV=production
```

---

## 10. Estrutura de Pastas (Monorepo)

```
comunica-social/
├── apps/
│   ├── api/                    # Backend Fastify
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── tenants/
│   │   │   │   ├── users/
│   │   │   │   ├── social-accounts/
│   │   │   │   ├── posts/
│   │   │   │   ├── media/
│   │   │   │   ├── inbox/
│   │   │   │   ├── ai/
│   │   │   │   ├── analytics/
│   │   │   │   └── webhooks/
│   │   │   ├── workers/
│   │   │   ├── lib/
│   │   │   │   ├── meta/       # Meta Graph client
│   │   │   │   ├── cloudinary/
│   │   │   │   ├── anthropic/
│   │   │   │   └── crypto/
│   │   │   ├── plugins/
│   │   │   └── server.ts
│   │   └── prisma/
│   │       └── schema.prisma
│   └── web/                    # Frontend React
│       └── src/
│           ├── pages/
│           ├── components/
│           ├── hooks/
│           ├── lib/
│           └── App.tsx
├── packages/
│   └── shared/                 # Types partilhados
└── package.json
```

---

## 11. Restrições e Considerações

### Limites Meta API

- **Rate limit:** 200 chamadas/hora/utilizador, 4800/dia/app
- **Instagram:** máximo 25 posts/dia/conta
- **Tokens:** longa duração = 60 dias (renovar antes)

### App Review Meta

- Processo de 4-8 semanas estimado
- Requer vídeo demo de cada permissão
- Business Verification obrigatória para Futurix/COMUNICA
- Plataforma deve estar funcional antes de submeter

### Custos Estimados (MVP)

| Item                                | Custo/mês           |
| ----------------------------------- | ------------------- |
| Railway (API + Web + DB + Redis)    | ~30-50 USD          |
| Cloudinary (free tier inicialmente) | 0 USD               |
| Claude API (uso moderado)           | ~20-50 USD          |
| Domínio (.ao)                       | ~30 USD/ano         |
| Meta API                            | 0 USD               |
| **Total inicial**                   | **~50-100 USD/mês** |

### Compliance

- LGPD/Lei de Proteção de Dados Angola (Lei 22/11)
- Termos de serviço Meta (proibir spam, conteúdo proibido)
- Direitos de imagem dos uploads de clientes

---

## 12. Roadmap pós-MVP

1. LinkedIn integration
2. TikTok integration
3. X/Twitter integration
4. Analytics avançado (dashboards, AI insights)
5. Geração de imagens com IA
6. Sistema de pagamento/billing
7. White-label para agências
8. Mobile app (React Native)
9. Integração com WhatsApp Business
10. Editor de imagens embutido
