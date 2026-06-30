---
name: pipeline-inline
description: Executa o pipeline completo de desenvolvimento do Bolão da Copa (PM → Analista → Programador → Revisor) de forma inline, sem delegar para subagentes. Use quando quiser implementar uma feature do início ao fim em um único contexto, sem depender de Agent Tool. Ideal para correções rápidas, features pequenas ou quando subagentes não estão disponíveis.
---

# Pipeline Inline — Bolão da Copa

Executa o pipeline de desenvolvimento completo de forma sequencial e inline: planejamento de produto, especificação técnica, implementação, revisão e merge. Tudo sem delegar para subagentes — você mesmo executa cada fase.

## Pré-requisitos

Antes de começar, leia estes arquivos para entender o contexto completo do projeto:

- `CLAUDE.md` — stack, regras de pontuação, modelo de dados, funcionalidades
- `DESIGN.md` — paleta de cores, tipografia, estilo visual (Elifoot retro)
- `.pipeline/product-roadmap.md` — estado atual do roadmap (se existir)
- `.pipeline/*-changelog.md` — changelogs de features já implementadas (se existirem)

## Fluxo do Pipeline

Use `UpdatePlan` para manter um plano visível com o progresso de cada fase. O fluxo completo é:

```
Fase 1: Produto      → define objetivo, atualiza roadmap
Fase 2: Especificação → escreve spec técnica (<slug>-spec.md)
Fase 3: Implementação → cria branch, plano, implementa, changelog
Fase 4: Revisão       → revisa código contra spec e convenções
Fase 5: Correções     → loop: fix-N → implementa → revisa (até aprovar)
Fase 6: Merge         → merge na main, atualiza changelogs e roadmap
```

---

## Fase 1 — Produto (PM)

**Objetivo:** Definir o escopo da feature e garantir que o roadmap reflita o estado atual.

### Passos

1. **Leia o contexto** — `CLAUDE.md`, `DESIGN.md`, `.pipeline/product-roadmap.md` (se existir)
2. **Defina o slug** — curto, em kebab-case, descritivo (ex: `fix-ranking-ordering`, `add-email-notifications`)
3. **Escreva o objetivo** — 1-2 frases claras sobre o que a feature entrega
4. **Defina critérios de sucesso** — 2-5 critérios testáveis e mensuráveis
5. **Atualize ou crie o roadmap** — adicione a feature em `.pipeline/product-roadmap.md`:
   - Se o roadmap não existe, crie-o com a feature como primeira entrada
   - Se existe, adicione a feature com status `em progresso`
   - Descreva dependências (features que devem existir antes)
6. **Commit do roadmap**:
   ```bash
   git add .pipeline/product-roadmap.md
   git commit -m "chore(pipeline): adiciona <slug> ao roadmap"
   ```
   Se o roadmap é novo, use mensagem: `"chore(pipeline): cria product-roadmap.md"`

### Formato do roadmap

```markdown
# Product Roadmap — Bolão da Copa

Criado em: YYYY-MM-DD

## Status Geral
- Total: N features
- Concluídas: N
- Em progresso: N
- Pendentes: N

## Features Priorizadas

### 1. [slug] — Nome da Feature — em progresso
**Objetivo:** Descrição clara do que esta feature entrega.
**Critérios de sucesso:**
- Critério testável 1
- Critério testável 2
**Dependências:** slug-1, slug-2 (ou "nenhuma")
```

---

## Fase 2 — Especificação (Analista)

**Objetivo:** Escrever uma especificação técnica completa para que a implementação seja inequívoca.

### Passos

1. **Releia o contexto** — `CLAUDE.md` (stack, regras de negócio, modelo de dados), `DESIGN.md`, roadmap
2. **Leia changelogs** — se houver features implementadas, leia `.pipeline/*-changelog.md` para entender o que já existe
3. **Escreva a spec** — crie `.pipeline/<slug>-spec.md` usando o formato abaixo
4. **Commit da spec**:
   ```bash
   git add .pipeline/<slug>-spec.md
   git commit -m "chore(<slug>): adiciona spec"
   ```

### Formato da spec

```markdown
# Spec: <Nome da Feature>

**Slug:** <slug>
**Data:** YYYY-MM-DD
**Status:** spec

---

## Objetivo

Descrição clara do que esta feature entrega.

---

## Histórias de Usuário

- Como [tipo de usuário], quero [ação] para [benefício]

---

## Modelo de Dados

### Tabelas novas ou modificadas
Descrever cada tabela/coluna com tipo e constraints. Incluir RLS policies se aplicável.

### Migrations necessárias
Listar as migrations SQL.

---

## Backend — Endpoints Ruby/Sinatra

### POST /api/<recurso>
**Autenticação:** requerida / pública
**Body (JSON):** `{ "campo": "tipo" }`
**Resposta (200):** `{ "campo": "valor" }`
**Erros:** 401, 422, etc.

---

## Frontend — Componentes React

### <NomeDoComponente>
**Arquivo:** `components/bolao/<Nome>.tsx`
**Props:** interface TypeScript
**Estados:** loading | error | empty | populated
**Comportamento:** interações e lógica de UI
**Supabase Realtime:** sim/não — canal e evento

---

## Regras de Negócio

Regras específicas. Ex: cálculo de pontos, deadlines, lógica de bloqueio.

---

## Proteção de Rotas

- Rotas que requerem autenticação
- Middleware de proteção
- Redirecionamento para login

---

## Integração Supabase Realtime

- Tabela observada
- Eventos: INSERT | UPDATE | DELETE
- Canal: `realtime:<tabela>:<filtro>`
- Ação ao receber evento

---

## Critérios de Aceite

- [ ] Critério testável 1
- [ ] Critério testável 2
- [ ] Design segue DESIGN.md
- [ ] Funciona em mobile (coluna única)
```

### Diretrizes para boas specs

- Seja específico: evite "fazer X" — escreva "criar endpoint POST /api/predictions que aceita `{game_id, home_score, away_score}` e retorna `{id, points_preview}`"
- Cubra estados de erro: o que acontece se o deadline expirou? Se o usuário não está autenticado?
- Referencie tokens de design: `color-accent`, `color-primary`, `color-bg`
- Regras de negócio como pseudocódigo quando necessário

---

## Fase 3 — Implementação (Programador)

**Objetivo:** Implementar a feature seguindo a spec, com qualidade e convenções do projeto.

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS 4 + React 19 |
| Backend | Ruby 3.x / Sinatra — Vercel Serverless Functions (`@vercel/ruby`) |
| Banco | Supabase (PostgreSQL + Realtime + Auth) |
| Deploy | Vercel |

### Passos

1. **Leia a spec** — `.pipeline/<slug>-spec.md` completamente
2. **Crie a branch**:
   ```bash
   git checkout -b feature/<slug>
   ```
3. **Escreva o plano** — `.pipeline/<slug>-plan.md` com tarefas ordenadas
4. **Commit do plano**:
   ```bash
   git add .pipeline/<slug>-plan.md
   git commit -m "chore(<slug>): adiciona plano de implementação"
   ```
5. **Implemente** — uma tarefa por vez, commit a cada tarefa concluída
6. **Escreva o changelog** — `.pipeline/<slug>-changelog.md`
7. **Commit do changelog**:
   ```bash
   git add .pipeline/<slug>-changelog.md
   git commit -m "chore(<slug>): adiciona changelog da implementação"
   ```

### Formato do plano

```markdown
# Plano de Implementação: <Nome da Feature>

**Slug:** <slug>
**Branch:** feature/<slug>
**Data:** YYYY-MM-DD
**Spec:** .pipeline/<slug>-spec.md

## Tarefas

- [ ] 1. <Tarefa específica>
- [ ] 2. <Tarefa específica>
- [ ] 3. <Tarefa específica>
```

### Formato do changelog

```markdown
# Changelog: <Nome da Feature>

**Slug:** <slug>
**Branch:** feature/<slug>
**Data:** YYYY-MM-DD
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Ruby/Sinatra)
- `api/<arquivo>.rb` — descrição

### Frontend (Next.js/React)
- `app/(dashboard)/<rota>/page.tsx` — descrição
- `components/bolao/<Componente>.tsx` — descrição

### Banco de Dados
- Migration: descrição das mudanças
- RLS policies adicionadas

---

## Decisões técnicas

Justificativa de escolhas não óbvias.

---

## Pontos de atenção para revisão

Aspectos a verificar com cuidado.

---

## Commits realizados

Resultado de `git log main..HEAD --oneline`
```

### Convenções de código

**Git:**
- Branch: `feature/<slug>`
- Commits em português: `feat(<slug>): descrição`, `fix(<slug>): descrição`, `chore(<slug>): descrição`
- Um commit por tarefa do plano

**Ruby/Sinatra:**
- Arquivos em `api/*.rb`
- Autenticação via JWT do Supabase (header `Authorization: Bearer <token>`)
- Resposta sempre JSON; erros: `{ error: "mensagem" }` com status HTTP

**Next.js/React:**
- App Router (não Pages Router)
- Server Components por padrão; `"use client"` só quando necessário
- Tailwind com tokens de DESIGN.md
- Fonte: `JetBrains Mono` via `next/font/google`
- Textos em português brasileiro
- Arquivos: `kebab-case.tsx`, componentes: `PascalCase`

**Design:**
- Paleta: `color-bg` (#0a0e1a), `color-text` (#f0f4f8), `color-accent` (#FFDF00)
- Bordas simples, sem sombras, estilo Elifoot retro
- Símbolos ASCII: ►, ✓, ✗, ██, ⏱
- Mobile first: coluna única

---

## Fase 4 — Revisão (Revisor)

**Objetivo:** Garantir que a implementação está correta, completa e segue as convenções.

### Passos

1. **Leia os artefatos** — `.pipeline/<slug>-changelog.md` e `.pipeline/<slug>-spec.md`
2. **Analise as mudanças**:
   ```bash
   git diff main feature/<slug>
   git log main..feature/<slug> --oneline
   ```
3. **Revise cada arquivo** contra os critérios abaixo

### Critérios de revisão

**Completude:**
- [ ] Todos os critérios de aceite da spec implementados?
- [ ] Todos os endpoints da spec existem e funcionam?
- [ ] Todos os componentes React da spec foram criados?
- [ ] Migrations/mudanças de banco implementadas?

**Correção técnica:**
- [ ] Lógica de negócio correta (cálculo de pontos, deadlines)?
- [ ] Autenticação Supabase validada nos endpoints?
- [ ] RLS policies configuradas?
- [ ] Supabase Realtime implementado onde a spec exige?

**Stack e convenções:**
- [ ] Next.js App Router?
- [ ] Ruby/Sinatra como Vercel Functions?
- [ ] Commits em português, prefixo correto?
- [ ] Branch `feature/<slug>`?

**Design:**
- [ ] Paleta de DESIGN.md respeitada?
- [ ] Tipografia `JetBrains Mono`?
- [ ] Estilo Elifoot: bordas simples, sem sombras?
- [ ] Interface em português brasileiro?
- [ ] Mobile first: funciona em coluna única?

**Segurança:**
- [ ] Sem SQL injection?
- [ ] Sem XSS (nunca renderizar HTML não sanitizado)?
- [ ] Sem bypass de autenticação?
- [ ] Sem credenciais hardcoded?

---

## Fase 5 — Loop de Correções

Se a revisão encontrar problemas, entre no loop de correções. Repita até aprovar.

### Para cada rodada de correção (N = 1, 2, 3...)

1. **Escreva o fix** — `.pipeline/<slug>-fix-N.md`:
   ```markdown
   # Fix N: <Nome da Feature>

   **Slug:** <slug>
   **Data:** YYYY-MM-DD
   **Rodada de revisão:** N

   ---

   ## Problemas Encontrados

   ### Problema 1: <Título curto>
   **Arquivo:** `caminho/do/arquivo` (linha X)
   **Severidade:** crítico | importante | menor
   **Descrição:** O que está errado e por quê.
   **Correção esperada:** O que deve ser feito.

   ---

   ## Itens OK (não precisam ser revisados novamente)

   - Item que estava correto
   ```

2. **Commit do fix**:
   ```bash
   git add .pipeline/<slug>-fix-N.md
   git commit -m "chore(<slug>): adiciona fix-N com correções solicitadas"
   ```

3. **Implemente as correções** — na branch `feature/<slug>`, corrija cada problema listado. Commit por correção.

4. **Atualize o changelog** — adicione seção "Correções Fix N" em `.pipeline/<slug>-changelog.md`

5. **Commit do changelog atualizado**:
   ```bash
   git add .pipeline/<slug>-changelog.md
   git commit -m "chore(<slug>): atualiza changelog com correções fix N"
   ```

6. **Re-revise** — volte para a Fase 4 com os mesmos critérios. Se ainda houver problemas, incremente N e repita.

**Limite de segurança:** se chegar a N=5 sem aprovação, pare e reporte os problemas restantes. Não entre em loop infinito.

---

## Fase 6 — Merge e Finalização

Quando a revisão for aprovada:

1. **Marque o changelog como aprovado** — altere `Status:` para `aprovado` em `.pipeline/<slug>-changelog.md`

2. **Atualize o CHANGELOG.md raiz** — adicione entrada da feature:
   ```markdown
   ## [<slug>] — <Nome da Feature> — YYYY-MM-DD

   - Resumo do que foi implementado
   - Endpoints criados
   - Componentes criados
   - Mudanças no banco
   ```

3. **Commit das atualizações**:
   ```bash
   git add .pipeline/<slug>-changelog.md CHANGELOG.md
   git commit -m "chore(<slug>): marca changelog como aprovado e atualiza CHANGELOG.md"
   ```

4. **Merge na main**:
   ```bash
   git checkout main
   git merge feature/<slug> --no-ff -m "merge(feature/<slug>): integra <nome da feature>"
   ```

5. **Atualize o roadmap** — em `.pipeline/product-roadmap.md`, marque a feature como `concluída`

6. **Commit final do roadmap**:
   ```bash
   git add .pipeline/product-roadmap.md
   git commit -m "chore(pipeline): marca <slug> como concluída no roadmap"
   ```

7. **Resumo final** — liste o que foi entregue: slug, branch, commits, arquivos criados/modificados.

---

## Uso com UpdatePlan

Durante toda a execução, mantenha um plano visível com `UpdatePlan`. Exemplo:

```markdown
## Pipeline Inline: <nome-da-feature>

- [x] Fase 1: Produto — objetivo definido, roadmap atualizado
- [x] Fase 2: Especificação — spec escrita
- [>] Fase 3: Implementação — implementando tarefa 3/5
- [ ] Fase 4: Revisão
- [ ] Fase 5: Merge e finalização
```

Atualize o plano a cada transição de fase.

---

## Quando usar vs não usar

**Use esta skill quando:**
- A feature é pequena ou média (1-5 tarefas de implementação)
- Você quer controle total sobre cada etapa
- Subagentes (Agent Tool) não estão disponíveis
- É uma correção rápida ou melhoria pontual

**Prefira o pipeline com agentes (`/pipeline`) quando:**
- A feature é grande e complexa (10+ tarefas)
- Você quer paralelismo (ex: Explorador rodando enquanto outra feature é implementada)
- O contexto do LLM pode não caber todo o pipeline inline
- Você quer delegação automática sem supervisão constante
