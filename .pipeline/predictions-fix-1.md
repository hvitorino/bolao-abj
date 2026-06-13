# Fix 1: Palpites (Predictions)

**Slug:** predictions
**Data:** 2026-06-13
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: `useCallback` importado sem uso em PredictionForm
**Arquivo:** `components/bolao/PredictionForm.tsx` (linha 3)
**Severidade:** menor
**Descrição:** `useCallback` está no import mas não é utilizado em nenhum lugar do componente. ESLint reporta warning `@typescript-eslint/no-unused-vars` que com `--max-warnings=0` quebra o lint.
**Correção esperada:** Remover `useCallback` do import na linha 3: `import { useState, useEffect } from 'react'`

---

## Itens OK (não precisam ser revisados novamente)

- Migration SQL: tabela, constraints UNIQUE, CHECK >= 0, índices, RLS — CORRETO
- Endpoint Ruby: autenticação JWT via Supabase API, validação de deadline (5min), verificação de duplicata, codes de erro descritivos — CORRETO
- PredictionDisplay: design Elifoot, cor `color-win` para "✓ SEU PALPITE", placar `color-accent` — CORRETO
- PredictionForm: countdown com `setInterval` limpo no `useEffect`, lógica `minutesRemaining <= 0`, urgência < 30min — CORRETO
- GameCard: área de palpite separada por borda tracejada, lógica por status (pending/live/finished) — CORRETO
- GameList: `predictionsByGameId` com valor default `{}`, repasse correto para GameCard — CORRETO
- Página /jogos: busca de palpites server-side, map `predictionsByGameId`, count unificado — CORRETO
- TypeScript strict: sem erros em `npx tsc --noEmit --strict` — CORRETO
- Design DESIGN.md: paleta correta, fonte monospace, estilo Elifoot, português — CORRETO
- Segurança: RLS sem UPDATE policy, JWT validado no backend, sem credenciais hardcoded — CORRETO
