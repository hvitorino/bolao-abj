# Spec: Palpite para Todos os Grupos

**Slug:** predict-all-groups
**Data:** 2026-06-18
**Status:** spec

---

## Objetivo

Após confirmar um palpite (criação ou edição) no grupo ativo, oferecer ao usuário a opção de
propagar aquele mesmo placar para todos os demais grupos dos quais ele participa, respeitando o
deadline de 5 minutos em cada grupo individualmente. O comportamento atual — salvar apenas no
grupo ativo — é preservado como opção padrão.

---

## Histórias de Usuário

- Como participante de múltiplos grupos, quero poder salvar meu palpite em todos os meus grupos
  de uma vez para não precisar trocar de grupo ativo manualmente.
- Como participante, quero escolher entre "salvar só neste grupo" e "salvar em todos os grupos"
  para ter controle sobre onde meu palpite é registrado.
- Como participante, quero receber um feedback claro de quantos grupos foram atualizados para
  saber o resultado da propagação.
- Como participante, quero que jogos com deadline expirado em outros grupos sejam ignorados
  silenciosamente, sem bloquear o salvamento nos grupos onde ainda é possível palpitar.

---

## Modelo de Dados

### Tabelas modificadas

Nenhuma migration nova é necessária. O modelo existente já suporta a feature:

- `predictions (id, user_id, game_id, group_id, home_score, away_score, submitted_at, UNIQUE(user_id, game_id, group_id))` — UPSERT por grupo permite palpites distintos por grupo.
- `group_members (group_id, user_id, role, joined_at)` — usada para listar todos os grupos do usuário.
- `games (id, match_date, status)` — usada para checar deadline em cada grupo (o jogo é o mesmo; o deadline depende apenas de `match_date`).

### Migrations necessárias

Nenhuma.

---

## Backend — Endpoints

### POST /api/predictions/broadcast

Novo endpoint dedicado à propagação do palpite para múltiplos grupos.

**Autenticação:** Bearer JWT obrigatório (mesmo padrão de `/api/predictions`)

**Body (JSON):**
```json
{
  "game_id": "uuid",
  "home_score": 2,
  "away_score": 1
}
```

`group_id` **não** é enviado — o endpoint resolve todos os grupos elegíveis do usuário no servidor.

**Lógica de execução:**

1. Autenticar usuário via JWT.
2. Validar `game_id` (UUID), `home_score` e `away_score` (inteiros >= 0).
3. Buscar o jogo (`match_date`, `status`) — retornar `404` se não encontrado.
4. Calcular o deadline: `match_date - 5min`. Se `now() >= deadline` para este jogo, retornar `422 deadline_expired` imediatamente (nenhum grupo pode receber o palpite).
5. Buscar todos os grupos do usuário via `group_members` (`group_id` de todos onde `user_id = auth_user_id`).
6. Para cada grupo:
   a. Verificar se o jogo está elegível: `status = 'pending'` E `match_date - now() > 5min` (mesma lógica do endpoint principal).
   b. Fazer UPSERT em `predictions` com `ON CONFLICT (user_id, game_id, group_id) DO UPDATE SET home_score = ..., away_score = ..., submitted_at = now()`.
   c. Registrar se o UPSERT criou ou atualizou (para o sumário de resposta).
7. Retornar sumário com total de grupos atualizados e lista de resultados por grupo.

**Resposta de sucesso (200):**
```json
{
  "updated_count": 3,
  "results": [
    { "group_id": "uuid-1", "group_name": "Bolão ABJ", "status": "saved" },
    { "group_id": "uuid-2", "group_name": "Família", "status": "saved" },
    { "group_id": "uuid-3", "group_name": "Trabalho", "status": "deadline_expired" }
  ]
}
```

`status` por grupo: `"saved"` (palpite salvo/atualizado) | `"deadline_expired"` (prazo expirado neste grupo — ignorado sem bloquear os demais).

**Erros possíveis:**
- `401`: não autenticado
- `404`: jogo não encontrado
- `422` com `error: "deadline_expired"`: deadline global do jogo já expirou (nenhum grupo é elegível — `match_date - now() <= 5min`)
- `422` com `error: "invalid_params"`: `game_id`, `home_score` ou `away_score` inválidos
- `500`: erro de banco

**Arquivo:** `app/api/predictions/broadcast/route.ts`

**Nota de implementação:** usar `serviceClient()` (service_role) para o UPSERT, idêntico ao padrão dos endpoints existentes de predictions. A verificação de membership já está implícita na query de `group_members` — só grupos onde o usuário é membro recebem o palpite.

---

## Frontend — Componentes React

### PredictionForm (modificado)

**Arquivo:** `components/bolao/PredictionForm.tsx`

**Mudança:** após submit bem-sucedido (status `'success'`), em vez de exibir imediatamente o `PredictionDisplay`, exibir o componente `PropagatePrompt` (ver abaixo) como overlay/painel dentro do `PredictionForm`. Somente após o usuário escolher "ESTE GRUPO" ou "TODOS OS GRUPOS" o formulário volta ao estado normal com `PredictionDisplay`.

**Novo estado interno:**
```typescript
type FormStatus = 'idle' | 'loading' | 'success' | 'propagating' | 'error'
// 'propagating' = palpite salvo no grupo ativo, aguardando decisão do usuário
```

**Fluxo:**
1. Submit bem-sucedido: `setStatus('propagating')`, guardar `savedPrediction` (retorno do POST/PATCH).
2. `PropagatePrompt` é renderizado no lugar do formulário.
3. Se usuário escolher "ESTE GRUPO": chamar `onSuccess?.(savedPrediction)`, fechar o prompt — comportamento idêntico ao atual.
4. Se usuário escolher "TODOS OS GRUPOS": chamar `POST /api/predictions/broadcast`, exibir feedback, depois chamar `onSuccess?.(savedPrediction)`.

**Props não mudam** (compatibilidade total com `GameCard.tsx`).

---

### PropagatePrompt (novo componente)

**Arquivo:** `components/bolao/PropagatePrompt.tsx`

**Props:**
```typescript
interface PropagatePromptProps {
  gameId: string
  homeScore: number
  awayScore: number
  homeTeamCode: string
  awayTeamCode: string
  onChooseSingle: () => void   // "ESTE GRUPO"
  onChooseAll: () => void      // "TODOS OS GRUPOS" — após broadcast concluído
}
```

**Estados internos:**
- `idle` — exibindo as duas opções
- `loading` — requisição de broadcast em andamento
- `done` — exibindo feedback de resultado
- `error` — erro na requisição de broadcast

**Layout (estilo Elifoot, inline styles, JetBrains Mono):**

```
┌──────────────────────────────────────────────────────┐
│  ✓ PALPITE REGISTRADO                                │
│  ─────────────────────────────────────────────────── │
│  BRA  2  ×  1  ARG                                  │
│                                                      │
│  Aplicar este palpite em:                           │
│                                                      │
│  [ ESTE GRUPO ]   [ TODOS OS GRUPOS ]               │
└──────────────────────────────────────────────────────┘
```

Estado `loading` (após clicar "TODOS OS GRUPOS"):
```
│  Salvando em outros grupos...                        │
```

Estado `done`:
```
│  ✓ PALPITE SALVO EM 3 GRUPOS                        │
│  (1 grupo com prazo encerrado foi ignorado)          │
```
— após 2 segundos, chamar `onChooseAll()` para fechar o prompt.

Estado `error`:
```
│  ✗ Erro ao propagar. Palpite salvo apenas neste grupo.  │
```
— após 2 segundos, chamar `onChooseSingle()` para fechar como se tivesse escolhido "ESTE GRUPO".

**Regras de design:**
- Fundo: `color-surface`, borda: `color-border`, 1px solid
- Título "✓ PALPITE REGISTRADO": `color-win`, uppercase, bold, 11px
- Placar resumido: `color-accent`, bold, 18px
- Label "Aplicar este palpite em:": `color-muted`, uppercase, 10px
- Botão "ESTE GRUPO": bg `color-border`, cor `color-text`, uppercase, bold, 12px, sem border-radius
- Botão "TODOS OS GRUPOS": bg `color-primary`, cor `color-bg`, uppercase, bold, 12px, sem border-radius
- Feedback de grupos ignorados (deadline expirado): `color-muted`, 10px, uppercase
- Botões lado a lado em linha; em mobile (< 360px) empilhados verticalmente
- Sem ícones decorativos SVG; usar `✓`, `✗` ASCII

**Comportamento quando usuário tem apenas 1 grupo:**
Não exibir `PropagatePrompt` — chamar `onSuccess?.(savedPrediction)` diretamente após submit bem-sucedido, sem prompt. Para saber se o usuário tem mais de um grupo, o componente pai (`PredictionForm`) pode não saber disso. A solução: sempre exibir o prompt, mas se o broadcast retornar `updated_count === 1` (somente o grupo ativo), exibir feedback "Palpite salvo — você participa de apenas 1 grupo." e fechar após 1.5s.

Alternativa mais simples e preferida: **sempre exibir o prompt**. O botão "TODOS OS GRUPOS" só faz a chamada de broadcast; se o resultado for `updated_count === 1`, o feedback é "Palpite salvo em 1 grupo." (sem mencionar outros grupos). Isso evita uma query extra só para verificar contagem de grupos.

---

## Regras de Negócio

1. **Deadline por jogo, não por grupo:** o deadline depende do `match_date` do jogo, que é compartilhado entre todos os grupos. Se o prazo expirou, expirou para todos os grupos simultaneamente. Logo, a verificação inicial no endpoint pode checar o deadline uma única vez antes de iterar pelos grupos.

2. **UPSERT, não INSERT:** se o usuário já tem palpite em outro grupo para aquele jogo, o UPSERT atualiza o placar (mesma lógica de edição). Isso é correto: "todos os grupos" significa "aplicar este placar em todos", mesmo que já haja palpite.

3. **Grupo ativo sempre incluído no broadcast:** o endpoint de broadcast opera sobre **todos** os grupos do usuário (incluindo o ativo). O palpite no grupo ativo já foi salvo pelo fluxo normal (POST /api/predictions ou PATCH /api/predictions/[id]); o broadcast vai fazer UPSERT idempotente nele também — resultado idêntico, sem duplicação.

4. **Palpite no grupo ativo já confirmado antes do prompt:** o `PropagatePrompt` só aparece após o palpite no grupo ativo ter sido salvo com sucesso. Se o usuário fechar a página sem escolher (navegação forçada, fechamento da aba), o palpite no grupo ativo já está salvo — não há perda de dados.

5. **Propagação não retroativa:** o broadcast só aplica o placar atual no momento da chamada. Edições posteriores no grupo ativo não propagam automaticamente para outros grupos — cada propagação é um ato explícito do usuário.

6. **Autorização:** o endpoint `/api/predictions/broadcast` verifica `group_members` para cada grupo antes de fazer UPSERT. Não é possível palpitar em grupo do qual o usuário não é membro.

7. **Não modifica palpites de jogos não-pending:** o endpoint ignora silenciosamente grupos onde o jogo não está `pending` ou onde o deadline expirou, em vez de retornar erro. O resultado é reportado no sumário como `deadline_expired`.

---

## Proteção de Rotas

Nenhuma rota nova de página. O endpoint `POST /api/predictions/broadcast` exige Bearer JWT — mesmo padrão de autenticação de `/api/predictions` e `/api/predictions/[id]`.

---

## Integração Supabase Realtime

Nenhuma subscrição nova. O broadcast cria/atualiza registros em `predictions`, que pode disparar eventos Realtime existentes nos outros grupos se algum cliente estiver conectado naquele canal. Isso é comportamento esperado e correto — sem necessidade de lógica adicional.

---

## Critérios de Aceite

- [ ] Palpite no grupo ativo funciona exatamente como antes (regressão zero em `PredictionForm`)
- [ ] Após submit bem-sucedido no grupo ativo, `PropagatePrompt` aparece dentro do card de palpite, no lugar do formulário
- [ ] Botão "ESTE GRUPO" fecha o prompt e exibe `PredictionDisplay` normalmente
- [ ] Botão "TODOS OS GRUPOS" chama `POST /api/predictions/broadcast`, exibe estado `loading` durante a requisição
- [ ] Após broadcast bem-sucedido, feedback exibe "PALPITE SALVO EM N GRUPOS" onde N é `updated_count`
- [ ] Grupos com deadline expirado aparecem no sumário como ignorados (sem erro fatal)
- [ ] Após 2 segundos no estado `done`, o prompt fecha e exibe `PredictionDisplay`
- [ ] Em caso de erro no broadcast, mensagem de erro exibida e prompt fecha após 2 segundos como "ESTE GRUPO"
- [ ] Endpoint `POST /api/predictions/broadcast` retorna `401` sem token, `404` para jogo inexistente, `422` se deadline global expirou
- [ ] Endpoint faz UPSERT corretamente: cria palpite se não existia, atualiza se já existia (incluindo o grupo ativo)
- [ ] Usuário com 1 grupo vê feedback "PALPITE SALVO EM 1 GRUPO" sem mensagem enganosa sobre outros grupos
- [ ] Design segue DESIGN.md: JetBrains Mono, paleta `color-primary`/`color-accent`/`color-muted`/`color-win`, sem border-radius, sem ícones SVG, border 1px solid
- [ ] Funciona em mobile (coluna única, botões empilhados em telas < 360px)
- [ ] `npm run lint` e `npm run build` passam sem erros
