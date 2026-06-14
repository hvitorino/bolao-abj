# Spec: Correção — Visibilidade Temporal dos Palpites

**Slug:** fix-prediction-visibility
**Data:** 2026-06-14
**Status:** spec

---

## Objetivo

Corrigir a visibilidade dos palpites na tela `/jogos` para que, enquanto o jogo estiver em estado `pending` (ainda não iniciado), somente o usuário autenticado veja o próprio palpite. Assim que o jogo deixar de estar `pending` — isto é, quando estiver `live` ou `finished` — os palpites dos demais participantes podem voltar a ser exibidos normalmente.

**Resolução explícita da ambiguidade:** a regra é temporal e baseada no status do jogo. Portanto, “depois que o jogo iniciou” e “em jogos já finalizados” significam a mesma condição operacional nesta spec: outros palpites só ficam visíveis quando o jogo **não está mais em `pending`**.

---

## Histórias de Usuário

- Como participante logado, quero ver apenas o meu palpite antes do jogo começar, para que os demais palpites não influenciem minha decisão.
- Como participante logado, quero voltar a ver os palpites de todos quando o jogo já tiver começado ou terminado, para comparar estratégias e acompanhar o bolão.
- Como participante logado, quero que a tela deixe claro quando o palpite de outro usuário está oculto por regra de negócio, em vez de parecer simplesmente ausente.

---

## Escopo Afetado

### Superfície principal

- `app/(dashboard)/jogos/page.tsx`
- `components/games/GameCard.tsx`
- `components/bolao/GameParticipantsList.tsx`

### Camada de dados / segurança

- Política RLS de `predictions`, hoje aberta a todos os usuários autenticados via migration da feature `game-participants-view`

---

## Diagnóstico do Estado Atual

Hoje a feature `game-participants-view` permite que qualquer usuário autenticado leia todos os palpites de `predictions`, independentemente do status do jogo:

- `app/(dashboard)/jogos/page.tsx` busca `allPredictions` sem distinguir jogos `pending`, `live` ou `finished`
- `components/bolao/GameParticipantsList.tsx` renderiza o valor de `p.prediction` para todos os participantes quando existir
- `supabase/migrations/20260614000002_participants_read_policies.sql` usa `USING (true)` em `predictions`, abrindo leitura irrestrita para autenticados

Isso conflita com a nova regra de produto.

---

## Modelo de Dados / RLS

### Migration nova

Criar migration para substituir a policy irrestrita de leitura de `predictions` por uma policy temporal:

**Arquivos esperados:**
- `supabase/migrations/20260614191000_fix_prediction_visibility_policy.sql`
- `db/migrations/20260614_fix_prediction_visibility_policy.sql`

### Regra da policy

Um usuário autenticado pode ler uma linha de `predictions` se:

1. `predictions.user_id = auth.uid()` **ou**
2. o jogo relacionado estiver com `status <> 'pending'`

Exemplo de regra:

```sql
DROP POLICY IF EXISTS "predictions_select_all_authenticated" ON predictions;
DROP POLICY IF EXISTS "predictions_select_started_or_own" ON predictions;

CREATE POLICY "predictions_select_started_or_own"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM games
      WHERE games.id = predictions.game_id
        AND games.status <> 'pending'
    )
  );
```

### Impacto esperado

- Jogos `pending`: a query retorna apenas o próprio palpite do usuário autenticado
- Jogos `live` / `finished`: a query retorna palpites de todos
- `scores` e `profiles` permanecem como estão; não é necessário alterar sua visibilidade para este fix

---

## Frontend

### `GameParticipantsList.tsx`

Quando `gameStatus === 'pending'`:

- linha do usuário atual:
  - mostra o palpite real se existir
  - mostra `-` se ainda não houver palpite
- linhas de outros participantes:
  - mostrar `OCULTO`
  - nunca renderizar o placar real de `p.prediction`, mesmo que por algum motivo chegue dados indevidos

Quando `gameStatus === 'live'` ou `gameStatus === 'finished'`:

- comportamento atual permanece:
  - mostra `H × A` se houver palpite
  - mostra `-` se não houver palpite

**Objetivo da defesa em profundidade:** mesmo com a proteção de RLS, a UI também deve aplicar a regra explicitamente para evitar regressão visual futura.

### `app/(dashboard)/jogos/page.tsx`

Pode manter a estratégia atual de montar `participantsByGameId`, mas o resultado de `allPredictions` passará a respeitar a policy temporal acima. Nenhum bypass com service role deve ser introduzido para essa leitura.

### `components/games/GameCard.tsx`

Não precisa mudar a regra de renderização da seção de participantes; a seção continua existindo em todos os status. A diferença é o conteúdo exibido pelo `GameParticipantsList`.

---

## Regras de Negócio

1. **Antes do início (`pending`)**: somente o próprio usuário autenticado vê seu palpite.
2. **Depois do início (`live`/`finished`)**: palpites dos demais usuários voltam a ficar visíveis.
3. **Critério temporal prioritário**: a regra depende exclusivamente de o jogo ter deixado ou não o estado `pending`.
4. **Consistência visual**: em jogos `pending`, terceiros não devem parecer “sem palpite” se a informação estiver apenas protegida; usar rótulo explícito `OCULTO`.
5. **Pontuação**: nenhuma mudança. A coluna PTS continua aparecendo apenas para jogos `finished`.

---

## Validação

### Cenários obrigatórios

1. **Jogo pending + usuário atual com palpite**
   - própria linha mostra o palpite
   - demais linhas mostram `OCULTO`

2. **Jogo pending + usuário atual sem palpite**
   - própria linha mostra `-`
   - demais linhas mostram `OCULTO`

3. **Jogo live**
   - palpites de todos aparecem normalmente

4. **Jogo finished**
   - palpites de todos aparecem normalmente
   - coluna de pontos continua funcionando

### Verificações técnicas

- `npm run lint`
- `npm run build`
- revisão manual do diff para garantir que nenhum componente ou query siga exibindo palpites de terceiros em jogos `pending`

---

## Critérios de Aceite

- [ ] Em jogos `pending`, a interface não exibe palpites de outros usuários
- [ ] Em jogos `pending`, o próprio usuário continua vendo seu palpite normalmente
- [ ] Em jogos `live` e `finished`, os palpites dos demais usuários permanecem visíveis
- [ ] A UI usa texto em pt-BR (`OCULTO`) e segue o estilo existente do projeto
- [ ] A política de leitura em `predictions` passa a refletir a regra temporal, evitando exposição indevida no backend
- [ ] `GameParticipantsList` aplica a regra também no frontend como defesa em profundidade
- [ ] `npm run lint` e `npm run build` passam com a alteração
