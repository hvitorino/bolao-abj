# Plano de Implementação: Autenticação

**Slug:** auth
**Branch:** feature/auth
**Data:** 2026-06-13
**Spec:** .pipeline/auth-spec.md

## Tarefas

- [ ] 1. Inicializar projeto Next.js 15 com Tailwind CSS 4 e TypeScript
- [ ] 2. Instalar dependências Supabase: `@supabase/supabase-js @supabase/ssr`
- [ ] 3. Criar `app/globals.css` com variáveis CSS da paleta DESIGN.md e import da fonte JetBrains Mono
- [ ] 4. Criar `app/layout.tsx` (root layout com fonte JetBrains Mono)
- [ ] 5. Criar `lib/supabase/client.ts` (browser client singleton)
- [ ] 6. Criar `lib/supabase/server.ts` (server client SSR com cookies)
- [ ] 7. Criar `middleware.ts` na raiz (proteção de rotas via Next.js middleware)
- [ ] 8. Criar `components/ui/Button.tsx` (botão reutilizável — uppercase, sem sombra, borda simples)
- [ ] 9. Criar `components/ui/Input.tsx` (input reutilizável — fonte monospace, bg surface)
- [ ] 10. Criar `app/(auth)/layout.tsx` (layout público — centrado verticalmente, sem nav)
- [ ] 11. Criar `app/(auth)/login/page.tsx` (formulário de login com estados idle/loading/error/success)
- [ ] 12. Criar `app/(auth)/cadastro/page.tsx` (formulário de cadastro com validação de senhas)
- [ ] 13. Criar `app/(dashboard)/layout.tsx` (layout protegido placeholder com botão de logout)

## Dependências entre tarefas

- Tarefas 3-4 dependem da tarefa 1 (projeto inicializado)
- Tarefas 5-7 dependem da tarefa 1
- Tarefas 8-9 dependem das tarefas 3-4 (CSS vars disponíveis)
- Tarefas 10-13 dependem de 5, 6, 7, 8, 9

## Arquivos a criar

```
bolao-abj/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── cadastro/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   └── layout.tsx
│   ├── globals.css
│   └── layout.tsx
├── lib/
│   └── supabase/
│       ├── client.ts
│       └── server.ts
├── components/
│   └── ui/
│       ├── Button.tsx
│       └── Input.tsx
└── middleware.ts
```

## Notas

- O projeto precisa ser inicializado com `create-next-app` antes de implementar os arquivos
- Não há backend Ruby/Sinatra nesta feature (auth é 100% via Supabase Auth SDK)
- Migration SQL deve ser executada manualmente no Supabase SQL Editor
- Variáveis de ambiente necessárias: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
