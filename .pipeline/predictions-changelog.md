# Changelog: Palpites (Predictions)

**Slug:** predictions
**Branch:** feature/predictions
**Data:** 2026-06-13
**Status:** aprovado

---

## O que foi implementado

### Backend (Ruby/Sinatra)

- `api/predictions.rb` — Vercel Function em Ruby/Rack com dois métodos:
  - **POST /api/predictions** — Registra palpite com validações em cascata: autenticação JWT, presença e tipo dos campos, existência do jogo, deadline (5min antes de `match_date`), unicidade (UNIQUE constraint + verificação prévia). Retorna 201 com o palpite criado ou 401/404/422/500 com mensagem descritiva.
  - **GET /api/predictions?game_id=UUID** — Retorna o palpite do usuário autenticado para o jogo solicitado, ou `null` se não enviado. Requer autenticação JWT.
  - Autenticação via `GET /auth/v1/user` do Supabase com Bearer token
  - Queries ao Supabase via REST API com `service_role` para operações de escrita (bypass RLS no backend controlado)
  - CORS headers configurados para preflight OPTIONS

### Frontend (Next.js/React)

- `components/bolao/PredictionForm.tsx` — Client Component com formulário inline de palpite:
  - Inputs numéricos estilo LED: borda `color-accent`, bg `color-bg`, largura fixa 48px
  - Countdown regressivo (`useEffect` com `setInterval` de 1s): exibe "⏱ FECHA EM Xh Ymin" quando faltam < 2h; muda para `color-error` quando < 30min
  - Deadline automático: quando `match_date - now() <= 5min`, inputs e botão ficam desabilitados e exibe "✗ PRAZO ENCERRADO"
  - Submissão via `fetch POST /api/predictions` com JWT obtido do `supabase.auth.getSession()`
  - Após sucesso, substitui o formulário por `PredictionDisplay` sem reload de página
  - Feedback de erro para `deadline_expired`, `already_submitted` e erros de rede

- `components/bolao/PredictionDisplay.tsx` — Componente de exibição de palpite já enviado:
  - Borda `color-primary`, placar em `color-accent` (22px bold), título "✓ SEU PALPITE" em `color-win`
  - Exibe horário de envio em BRT ("enviado às 14:53 BRT")
  - Puro display, sem interatividade

- `components/games/GameCard.tsx` — Modificado para:
  - Tornar-se Client Component (`"use client"`) para integrar `PredictionForm`
  - Aceitar nova prop `prediction?: Prediction | null`
  - Área de palpite separada por `border-top: 1px dashed var(--color-border)` no final do card
  - Jogo `pending`: renderiza `PredictionForm` (que internamente decide entre formulário ou display)
  - Jogo `live`/`finished`: renderiza `PredictionDisplay` se há palpite, ou "SEM PALPITE" em `color-muted`

- `components/games/GameList.tsx` — Modificado para:
  - Aceitar nova prop `predictionsByGameId?: Record<string, Prediction>`
  - Repassar `prediction={predictionsByGameId[game.id] ?? null}` para cada `GameCard`

- `app/(dashboard)/jogos/page.tsx` — Modificado para:
  - Buscar palpites do usuário para os jogos do dia após buscar os jogos
  - Construir `predictionsByGameId` (map game_id → Prediction) para acesso O(1)
  - Repassar `predictionsByGameId` para `GameList`
  - Contagem de palpites (`guessCount`) agora vem da mesma query de predictions

### Tipos TypeScript

- `lib/types/prediction.ts` — Interface `Prediction` com todos os campos da tabela

### Banco de Dados

- `db/migrations/20260613_create_predictions.sql` — Migration completa:
  - Tabela `predictions` com `UNIQUE(user_id, game_id)`, CHECK `>= 0` em scores
  - Índices em `user_id`, `game_id` e `(user_id, game_id)`
  - RLS habilitado com duas políticas: SELECT e INSERT apenas para o próprio usuário
  - SEM política UPDATE (palpites imutáveis) e SEM política DELETE

---

## Decisões técnicas

1. **`GameCard` como Client Component:** A integração do `PredictionForm` (que usa `useState`, `useEffect` e `fetch`) exige que o `GameCard` seja Client Component. A alternativa seria criar um wrapper Client separado, mas isso complicaria a API de componentes sem ganho real, pois o `GameCard` já era um componente terminal (sem Server-side data fetching próprio).

2. **Busca de predictions na página Server Component:** Os palpites do usuário são buscados no Server Component da página `/jogos` junto com os jogos, em vez de fazer fetch client-side. Isso elimina um loading state extra no cliente e melhora o First Contentful Paint — o usuário vê imediatamente se já enviou palpite ou não.

3. **`predictionsByGameId` como Record<string, Prediction>:** Usar um Map (objeto) em vez de array permite lookup O(1) em vez de O(n) quando o `GameList` precisa associar cada jogo ao seu palpite.

4. **Backend com `service_role` para leitura de games e verificação de existing predictions:** O RLS da tabela `predictions` permite que o usuário veja apenas seus próprios palpites. Para verificação de duplicata e busca de `match_date` no POST, usamos `service_role` no backend Ruby — o backend é confiável (não é o client) e precisa de acesso irrestrito para validações de negócio.

5. **Imutabilidade por design:** A ausência de política UPDATE no RLS (não apenas no backend) garante dupla proteção: mesmo que o endpoint Ruby seja comprometido, o banco de dados rejeitaria qualquer UPDATE em `predictions`.

6. **Validação de inteiros no frontend:** Os inputs `type="number"` são parseados com `parseInt()` e validados `>= 0`. A propriedade CSS `appearance: textfield` remove os spinners nativos para um visual mais limpo (estilo LED).

---

## Pontos de atenção para o Revisor

1. **`MozAppearance` no input:** O tipo `React.CSSProperties` não inclui a propriedade vendor `MozAppearance` por padrão. O TypeScript não reclama porque usamos type assertion, mas verificar se funciona no Firefox sem warnings.

2. **Validação de inteiros no body JSON do Ruby:** O Ruby faz `body['home_score'].is_a?(Integer)` — isso funciona corretamente com JSON parseado (JSON integers viram Ruby integers). Mas se o cliente enviar `"2"` (string), a validação falha propositalmente.

3. **CORS no endpoint Ruby:** Os headers CORS estão configurados com `Access-Control-Allow-Origin: *`. Em produção com Vercel, isso pode ser restringido para o domínio do projeto.

4. **`useCallback` importado mas não usado em `PredictionForm`:** O import de `useCallback` está presente mas não é utilizado diretamente (foi planejado para o handler mas não necessário). Deve ser removido.

5. **Tabela `predictions` não existente no banco:** A migration precisa ser executada manualmente no Supabase SQL Editor antes da feature funcionar. O código do frontend falha silenciosamente se a tabela não existir (palpites aparecem como `null` para todos os jogos).

6. **Contagem de palpites no `DayNavigator`:** A query de contagem (`count: 'exact'`) foi substituída pela mesma query de seleção completa de predictions, o que é um pouco mais custoso mas elimina uma query separada.

---

## Correções Fix 1

**Problema 1 (PredictionForm):** Removido `useCallback` do import — estava importado mas não utilizado, causando warning ESLint `@typescript-eslint/no-unused-vars`.

## Commits realizados

```
[fix commit] fix(predictions): remove import useCallback não utilizado em PredictionForm
b961cd2 feat(predictions): modifica página /jogos e GameList para buscar e repassar palpites aos GameCards
686bc50 feat(predictions): modifica GameCard para integrar área de palpite com PredictionForm e PredictionDisplay
efbc62c feat(predictions): adiciona componente PredictionForm com countdown e submissão JWT
edfc283 feat(predictions): adiciona componente PredictionDisplay com design Elifoot
4c4161b feat(predictions): adiciona endpoint Ruby POST/GET /api/predictions com validação de deadline
e84d21c feat(predictions): adiciona tipo TypeScript Prediction
9033ea0 feat(predictions): adiciona migration SQL para tabela predictions com RLS
cba52df chore(predictions): adiciona plano de implementação
```
