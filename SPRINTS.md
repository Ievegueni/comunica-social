# SPRINTS.md — COMUNICA Social MVP

> Plano de 12 sprints (~24 semanas) para o MVP. Cada sprint = 2 semanas.
> Entregas iterativas, sempre deployable no Railway.

---

## Visão Geral dos Sprints

| Sprint | Tema                 | Entregável principal                              |
| ------ | -------------------- | ------------------------------------------------- |
| 0      | Setup & Fundações    | Monorepo, CI/CD, deploy Railway                   |
| 1      | Auth & Multi-tenant  | Login, tenants, RBAC funcional                    |
| 2      | Conexão Meta (OAuth) | Conectar páginas FB e contas IG                   |
| 3      | Biblioteca de Mídia  | Upload Cloudinary + pastas + tags                 |
| 4      | Editor de Posts      | Criação + preview + draft                         |
| 5      | Publisher (Worker)   | Publicação real no FB e IG                        |
| 6      | Calendário Editorial | Vista calendário + drag-drop                      |
| 7      | Geração IA           | Integração Claude + fluxo de aprovação de gerados |
| 8      | Aprovação Editorial  | Workflow approver com notificações                |
| 9      | Inbox — Comentários  | Webhooks + UI de comentários FB/IG                |
| 10     | Inbox — DMs          | Messenger + Instagram DMs                         |
| 11     | Analytics Básico     | Métricas + export CSV                             |
| 12     | Polish + App Review  | Bugs, UX, submissão Meta App Review               |

---

## Sprint 0 — Setup & Fundações (2 semanas)

### Objetivos

- Estrutura monorepo
- Pipeline de deploy Railway
- Base técnica para próximos sprints

### Tasks

1. Inicializar monorepo (pnpm workspaces) com `apps/api` e `apps/web`
2. Setup Fastify + TypeScript + Prisma no `apps/api`
3. Setup React + Vite + Tailwind + shadcn/ui no `apps/web`
4. Configurar PostgreSQL + Redis no Railway
5. Schema Prisma inicial (Tenant, User, AuditLog)
6. Migrations + seed básico
7. Health checks + logging estruturado (pino)
8. GitHub Actions: lint + test + deploy automático
9. Configurar domínios `api.comunica.ao` + `app.comunica.ao`
10. Variáveis de ambiente Railway (todas do CLAUDE.md)

### Definition of Done

- `pnpm dev` corre API e Web localmente
- Push para `main` faz deploy automático
- API responde em `https://api.comunica.ao/health`
- Frontend acessível em `https://app.comunica.ao`

---

## Sprint 1 — Auth & Multi-tenant

### Objetivos

- Sistema de autenticação completo
- Criação de tenants
- RBAC funcional

### Tasks

1. Endpoint `POST /auth/signup` (cria Tenant + OWNER)
2. Endpoint `POST /auth/login` (JWT access + refresh)
3. Endpoint `POST /auth/refresh`
4. Endpoint `POST /auth/forgot-password` + `POST /auth/reset-password`
5. Middleware de autenticação + injeção de `tenantId` no contexto
6. Prisma middleware para row-level security por tenant
7. Endpoint `POST /users/invite` + fluxo de aceitação por email
8. CRUD de utilizadores (apenas ADMIN/OWNER)
9. RBAC enforcement em todas as rotas
10. UI: páginas de signup, login, esqueci-password, convite
11. UI: gestão de utilizadores
12. UI: layout base autenticado (sidebar + header)
13. Audit logs para ações sensíveis

### Definition of Done

- Posso registar uma empresa, fazer login, convidar utilizadores
- Roles funcionam (Editor não acede a config, etc.)
- Tokens expiram corretamente
- Reset password funcional via email

---

## Sprint 2 — Conexão Meta (OAuth)

### Objetivos

- Conectar páginas Facebook e contas Instagram Business
- Armazenamento seguro de tokens
- Renovação automática

### Tasks

1. Criar Meta App em developers.facebook.com (modo dev)
2. Implementar Facebook Login no frontend
3. Endpoint `GET /social/meta/callback` para exchange de code
4. Trocar short-lived token por long-lived (60 dias)
5. Buscar lista de páginas FB do utilizador
6. Buscar contas IG Business ligadas a essas páginas
7. UI: vista de seleção de contas a conectar
8. Encriptação AES-256-GCM dos access tokens em repouso
9. Função utilitária `metaClient(tenantId, socialAccountId)` que descripta token automaticamente
10. Endpoint `POST /social-accounts/connect`
11. Endpoint `DELETE /social-accounts/:id` (desconectar)
12. Endpoint `GET /social-accounts`
13. Worker BullMQ `token-refresher` (corre diariamente, renova tokens com <10 dias)
14. UI: dashboard mostra contas conectadas + status

### Definition of Done

- Posso conectar pelo menos 1 página FB e 1 conta IG Business
- Tokens guardados encriptados na BD
- Worker renova tokens automaticamente
- Posso desconectar contas

### Notas

- Para esta sprint, App Meta pode estar em **modo dev** (só utilizadores listados conseguem usar)
- App Review fica para Sprint 12

---

## Sprint 3 — Biblioteca de Mídia

### Objetivos

- Upload e organização de imagens/vídeos
- Estrutura de pastas
- Tags e filtros

### Tasks

1. Setup Cloudinary SDK no backend
2. Endpoint `POST /media/upload` (signed upload)
3. Endpoint `POST /media/folders` (criar pasta)
4. Endpoint `GET /media/folders` (árvore)
5. Endpoint `PATCH /media/folders/:id` (renomear/mover)
6. Endpoint `DELETE /media/folders/:id`
7. Endpoint `GET /media/assets` (com filtros: folder, tags, type, search)
8. Endpoint `PATCH /media/assets/:id` (tags, mover de pasta)
9. Endpoint `DELETE /media/assets/:id` (soft delete + remoção Cloudinary)
10. UI: vista de biblioteca (grid + lista)
11. UI: upload drag-and-drop multi-ficheiro
12. UI: árvore de pastas lateral
13. UI: tag editor + filtros
14. UI: preview de imagens/vídeos (modal)
15. Limite de tamanho por upload (50MB imagem, 200MB vídeo)
16. Geração automática de thumbnails

### Definition of Done

- Upload de imagens e vídeos funciona
- Pastas hierárquicas funcionam
- Filtros e busca funcionam
- Mídia eliminada some do Cloudinary

---

## Sprint 4 — Editor de Posts

### Objetivos

- Criar, editar e guardar posts
- Preview por rede social
- Drafts e agendamento

### Tasks

1. Endpoint `POST /posts` (criar)
2. Endpoint `PATCH /posts/:id` (editar)
3. Endpoint `GET /posts` (lista com filtros)
4. Endpoint `GET /posts/:id`
5. Endpoint `DELETE /posts/:id` (apenas DRAFT)
6. Endpoint `POST /posts/:id/duplicate`
7. Validação Zod do conteúdo (limites Meta: FB 63k chars, IG 2200 chars)
8. UI: editor de post (textarea + counter)
9. UI: selector de conta destino (multi)
10. UI: upload/seleção de mídia da biblioteca
11. UI: preview lado-a-lado (FB vs IG)
12. UI: date picker para agendamento (default: agora+1h)
13. UI: hashtag helper (separador especial)
14. UI: primeiro-comentário (IG only)
15. Draft auto-save (debounce 2s)
16. UI: lista de posts com filtros (status, conta, criador, data)

### Definition of Done

- Posso criar um post com texto + imagem
- Preview reflete o que vai aparecer
- Posso guardar como DRAFT
- Posso editar/duplicar/eliminar drafts

---

## Sprint 5 — Publisher (Worker)

### Objetivos

- Publicação real no Facebook e Instagram
- Sistema robusto de retry
- Tracking de posts publicados

### Tasks

1. Worker BullMQ `post-publisher`
2. Função `publishToFacebook(post)` — texto, foto, vídeo, link
3. Função `publishToInstagram(post)` — fluxo 2-passos (container + publish)
4. Agendamento: ao criar post com `scheduledFor`, criar job BullMQ
5. Atualização ao reagendar (cancel + recreate job)
6. Lógica de retry (3x, backoff exponencial 1min, 5min, 30min)
7. Validação de token antes de publicar (refresh se expirado)
8. Update de status: SCHEDULED → PUBLISHING → PUBLISHED / FAILED
9. Guardar `externalPostId` após sucesso
10. Endpoint `POST /posts/:id/publish-now` (forçar publicação imediata)
11. Endpoint `POST /posts/:id/cancel` (cancelar agendamento)
12. Notificações in-app de sucesso/falha
13. UI: badges de status + mensagens de erro
14. Logs detalhados (tenantId, postId, platform, error)

### Definition of Done

- Posto agendado é publicado na hora certa no FB e IG
- Falhas tentam retry 3x
- Status reflete realidade
- Posso ver o post real na rede social com link

---

## Sprint 6 — Calendário Editorial

### Objetivos

- Vista calendário dos posts
- Reagendamento drag-and-drop
- Filtros visuais

### Tasks

1. Endpoint `GET /posts/calendar?from=...&to=...`
2. Setup biblioteca calendário (FullCalendar React ou similar)
3. UI: vista mensal
4. UI: vista semanal
5. UI: vista diária (timeline)
6. Drag-and-drop de posts → chama `PATCH /posts/:id` com novo `scheduledFor`
7. Filtros: por conta, por status, por criador
8. Cores por plataforma (FB azul, IG rosa)
9. Cores por status (DRAFT cinza, SCHEDULED amarelo, PUBLISHED verde, FAILED vermelho)
10. Click no evento → modal com preview + ações rápidas
11. Botão "+" em slot vazio → abre editor com data pré-preenchida
12. Vista "fila" alternativa (lista cronológica)

### Definition of Done

- Vejo todos os posts agendados em calendário
- Posso arrastar para reagendar
- Filtros funcionam em tempo real

---

## Sprint 7 — Geração IA

### Objetivos

- Integração com Claude API
- Geração em lote de posts
- Fluxo de revisão e aprovação

### Tasks

1. Setup Anthropic SDK no backend
2. Toggle `aiGenerationEnabled` em settings do tenant
3. Endpoint `POST /ai/generate` → cria `AIGenerationJob`, dispara worker
4. Worker BullMQ `ai-generator`
5. Prompt template para geração de posts (briefing + tom + público + nº)
6. Resposta estruturada (JSON) com array de posts
7. Validação e parse do output Claude
8. Endpoint `GET /ai/jobs/:id` (polling de status)
9. Endpoint `GET /ai/jobs` (histórico)
10. Endpoint `POST /ai/jobs/:id/accept` (cria N posts em DRAFT a partir do resultado)
11. UI: form de briefing (multi-step wizard)
12. UI: vista de resultados gerados com edição inline
13. UI: aprovar individualmente ou em massa
14. UI: agendar todos automaticamente (distribuir nos próximos N dias)
15. Marcar posts criados como `source = AI_GENERATED`
16. Limite de geração por dia (anti-abuse)

### Definition of Done

- Defino briefing, recebo 10 posts gerados
- Posso editar e aprovar para criar drafts
- Drafts AI_GENERATED ficam marcados visualmente

---

## Sprint 8 — Aprovação Editorial

### Objetivos

- Fluxo de aprovação opcional
- Notificações
- Histórico de revisões

### Tasks

1. Toggle `approvalRequired` em settings do tenant
2. Quando ON: EDITOR cria post → status `PENDING_APPROVAL` (não `SCHEDULED`)
3. APPROVER recebe notificação (in-app + email)
4. Endpoint `POST /posts/:id/approve` (APPROVER/ADMIN/OWNER)
5. Endpoint `POST /posts/:id/reject` (com motivo)
6. Após aprovação → status passa a `SCHEDULED` + job BullMQ criado
7. UI: badge "Aguarda aprovação" + filtro
8. UI: vista dedicada "Para aprovar" para APPROVER
9. UI: histórico de revisões no detalhe do post
10. UI: comentários do APPROVER
11. EDITOR pode editar e reenviar após rejeição
12. Notificação ao EDITOR quando rejeitado/aprovado
13. Templates de email (Resend ou similar)

### Definition of Done

- Com toggle ON, posts criados ficam pendentes
- APPROVER vê fila + aprova/rejeita
- Notificações chegam corretamente

---

## Sprint 9 — Inbox: Comentários

### Objetivos

- Receber comentários FB e IG em tempo real
- Vista de inbox
- Responder comentários

### Tasks

1. Setup endpoint público `POST /webhooks/meta` + verify token GET
2. Validação de assinatura X-Hub-Signature
3. Parser de eventos `page.feed` (comentários FB)
4. Parser de eventos `instagram.comments`
5. Worker BullMQ `webhook-processor`
6. Criação de `InboxItem` por novo comentário
7. Linkagem ao Post quando `parentPostId` é nosso
8. Endpoint `GET /inbox` com filtros (type, status, account)
9. Endpoint `GET /inbox/:id`
10. Endpoint `POST /inbox/:id/reply` → chama Meta API
11. Endpoint `PATCH /inbox/:id/status` (ler, arquivar)
12. UI: inbox unificado com lista lateral + detalhe
13. UI: badges de não-lidas
14. UI: reply box + preview
15. UI: link para o post original
16. Polling fallback (15min) caso webhook falhe
17. Realtime via SSE ou WebSocket (novidades aparecem sem refresh)

### Definition of Done

- Comentário no FB aparece no inbox em <30s
- Respondo no inbox → comentário responde no FB
- Estados (lido/respondido/arquivado) funcionam

---

## Sprint 10 — Inbox: DMs

### Objetivos

- Mensagens diretas Messenger e Instagram
- Vista de conversação
- Resposta a DMs

### Tasks

1. Subscrição webhook `page.messages` (Messenger)
2. Subscrição webhook `instagram.messages`
3. Parser de eventos de DM
4. Modelo de threads (agrupar mensagens do mesmo `fromUserId`)
5. UI: vista de conversa (estilo chat)
6. UI: lista de conversas com último preview
7. Endpoint `POST /inbox/:id/reply` adaptado para DMs
8. Janela de 24h (Meta only allows replies dentro de 24h sem template)
9. Indicador visual da janela 24h
10. Suporte a anexos básicos (imagens recebidas)
11. UI: distinguir Messenger vs Instagram DM
12. Audit log de respostas

### Definition of Done

- DM recebida aparece no inbox
- Posso responder via plataforma
- Conversa fica agrupada por contacto

---

## Sprint 11 — Analytics Básico

### Objetivos

- Coleta automática de métricas
- Vista de performance
- Export CSV

### Tasks

1. Worker BullMQ `metrics-collector`
2. Jobs agendados: 1h, 24h, 7d, 30d após `publishedAt`
3. Chamadas Meta Insights API (FB e IG)
4. Guardar snapshots em `PostMetric`
5. Endpoint `GET /analytics/posts` (lista com métricas mais recentes)
6. Endpoint `GET /analytics/posts/:id/history` (snapshots ao longo do tempo)
7. Endpoint `GET /analytics/summary` (totais do tenant)
8. UI: tabela de posts com métricas (sortable)
9. UI: cards de KPIs (total reach, total engagement, posts publicados)
10. UI: gráfico simples de evolução por dia (recharts)
11. UI: filtros (data, conta, plataforma)
12. Endpoint `GET /analytics/export.csv`
13. UI: botão "Exportar CSV"

### Definition of Done

- Métricas dos posts aparecem automaticamente após publicação
- Vejo evolução temporal
- Export CSV funciona com dados corretos

---

## Sprint 12 — Polish + App Review Meta

### Objetivos

- Estabilização do MVP
- Submissão da App Review Meta
- Pronto para uso interno

### Tasks

1. Auditoria de UX (consistência, loading states, empty states)
2. Mensagens de erro user-friendly
3. Skeleton loaders
4. Acessibilidade básica (a11y)
5. Performance: lazy loading, code splitting
6. Mobile responsive review
7. Testes E2E críticos (Playwright): login, conectar conta, publicar, responder
8. Documentação interna (README, deployment guide)
9. Backup automático do PostgreSQL
10. Página de status e privacy policy (obrigatório para Meta)
11. Termos de serviço
12. **Vídeos demo para Meta App Review** (1 por permissão pedida)
13. Submissão Meta Business Verification
14. Submissão Meta App Review
15. Bug bash final
16. Tag v1.0.0

### Definition of Done

- App Review Meta submetida
- 0 bugs P0 ou P1
- Documentação completa
- Pronto para usar com Futurix e COMUNICA em produção

---

## Riscos e Mitigações

| Risco                                     | Mitigação                                                          |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Meta App Review demora >8 semanas         | Iniciar paperwork de Business Verification no Sprint 2 em paralelo |
| Token refresh falha silenciosamente       | Alertas + dashboard de status de contas                            |
| Webhooks Meta perdidos                    | Fallback de polling + log de eventos                               |
| Rate limits Meta atingidos                | Queue com throttle + retry inteligente                             |
| Custos Cloudinary disparam                | Monitorização + alertas + plano de upgrade                         |
| Conteúdo gerado pela IA viola termos Meta | Validação prévia + revisão manual obrigatória inicialmente         |

---

## Pós-MVP (não nesta lista)

- LinkedIn, TikTok, X integrações
- Analytics avançado (best time to post, AI insights)
- Geração de imagens com IA
- Sistema de billing/subscription (Stripe, Multicaixa)
- White-label
- App mobile (React Native)
- WhatsApp Business
- Editor de imagens embutido
- A/B testing de posts
- Aprovação multi-nível
