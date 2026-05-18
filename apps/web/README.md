# @comunica/web

Frontend do COMUNICA Social. React + Vite + Tailwind + shadcn/ui.

## Estrutura

```
src/
├── pages/         # Paginas da aplicacao
├── components/
│   └── ui/        # Componentes shadcn/ui
├── hooks/         # Custom hooks
├── lib/           # Utilitarios (api client, query client)
├── App.tsx        # Router principal
└── main.tsx       # Entry point
```

## Variaveis de ambiente

| Variavel       | Descricao          |
| -------------- | ------------------ |
| `VITE_API_URL` | URL da API backend |

## Scripts

```bash
pnpm dev       # Dev server (porta 5173)
pnpm build     # Build de producao
pnpm preview   # Preview do build
pnpm lint      # ESLint
pnpm test      # Testes
```
