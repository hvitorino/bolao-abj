# Spec: Distinção entre Palpite Oculto e Pendente

**Slug:** prediction-visibility
**Data:** 2026-06-17
**Status:** spec (retroativa)

---

## Objetivo

Evoluir a visibilidade dos palpites na tela `/jogos` para que, em jogos com status `pending`, a interface distinga dois estados para terceiros:

- **`OCULTO`** (cinza, `color-muted`): o participante já enviou seu palpite, mas ele está escondido por regra de negócio.
- **`PENDENTE`** (vermelho, `color-error`): o participante ainda não enviou palpite.

A feature predecessor `fix-prediction-visibility` resolveu o vazamento de dados (nenhum palpite de terceiro chega ao cliente em jogos `pending`), mas tornou os dois estados indistinguíveis — ambos apareciam como traço (`-`). Esta feature resolve essa lacuna visual sem comprometer a regra de privacidade.

---

## Histórias de Usuário

- Como participante logado, quero saber se outro participante já enviou seu palpite antes do jogo começar, para entender o engajamento do grupo, sem ver o valor do palpite.
- Como participante logado, quero que fique claro quando o palpite de outro está oculto por regra (e não ausente), para não confundir ocultamento com omissão.
- Como participante logado, quero continuar vendo meu próprio palpite normalmente em jogos `pending`, mesmo que o dos outros apareça oculto.
- Como participante logado, quero que em jogos `live` e `finished` o comportamento original seja mantido, com palpites de todos visíveis.

---

## Escopo Afetado

- `app/(dashboard)/jogos/page.tsx` — query adicional para verificar existência de palpites
- `components/bolao/GameParticipantsList.tsx` — lógica de label e cor da coluna PALPITE
- `lib/types/participant.ts` — campo `hasPrediction: boolean` em `ParticipantEntry`
- `lib/supabase/service-server.ts` — cliente service_role centralizado (novo arquivo)

---

## Modelo de Dados

Não há mudança de schema. A query de existência seleciona apenas `user_id` e `game_id` da tabela `predictions`, usando o cliente service_role para contornar o RLS (ver seção de decisão arquitetural abaixo).

---

## Regras de Negócio

1. **Antes do início (`pending`):**
   - Usuário atual: sempre vê seu próprio palpite real (ou `-` se ainda não enviou).
   - Terceiros com palpite: exibe `OCULTO` em `color-muted` (cinza).
   - Terceiros sem palpite: exibe `PENDENTE` em `color-error` (vermelho).

2. **Depois do início (`live` / `finished`):**
   - Comportamento original mantido: `H × A` se houver palpite, `-` se não houver.
   - Coluna de pontos continua aparecendo apenas em jogos `finished`.

3. **Privacidade mantida:** o valor do palpite (`home_score`, `away_score`) de terceiros nunca trafega para o cliente em jogos `pending`. A query de existência retorna apenas um booleano derivado de `user_id, game_id`.

---

## Frontend

### `GameParticipantsList.tsx`

A coluna PALPITE deve seguir a lógica:

```
se isCurrentUser:
  exibir palpite real (ou "-")
senão se gameStatus === 'pending':
  se hasPrediction === true  → "OCULTO"  (color-muted)
  se hasPrediction === false → "PENDENTE" (color-error)
senão:
  exibir palpite real (ou "-") em color-accent
```

### `app/(dashboard)/jogos/page.tsx`

Adicionar quinta query paralela usando `createServiceClient()` que busca `user_id, game_id` de `predictions` filtrado pelos `game_id` do dia ativo e pelos `user_id` dos membros do grupo. Montar índice `Set<string>` com chave composta `"userId:gameId"` para lookup O(1). Popular campo `hasPrediction` em cada `ParticipantEntry`.

---

## Decisão Arquitetural: Uso de service_role para Verificação de Existência

### Contexto

A feature `fix-prediction-visibility` (aprovada e mergeada em 2026-06-14) estabeleceu, em sua spec (linha 119): "Nenhum bypass com service role deve ser introduzido para essa leitura." Essa diretiva foi criada para proteger o **conteúdo** dos palpites (`home_score`, `away_score`) de terceiros em jogos `pending`.

### O que esta feature faz de diferente

Esta feature introduz uma query via service_role com escopo **estritamente diferente**: seleciona apenas `user_id` e `game_id` — campos que identificam a existência de um registro, sem revelar qualquer valor de palpite. O resultado é reduzido a um booleano (`hasPrediction`) antes de ser propagado para o Client Component.

| Dimensão | fix-prediction-visibility (proibido) | prediction-visibility (permitido) |
|---|---|---|
| Colunas selecionadas | `home_score`, `away_score`, ... | apenas `user_id, game_id` |
| Dado exposto ao cliente | valor do palpite | booleano de existência |
| Risco de vazamento | alto | nenhum |

### Por que RLS sozinho era insuficiente

A policy temporal de `fix-prediction-visibility` bloqueia a linha inteira de `predictions` de terceiros em jogos `pending`. Isso é correto para privacidade, mas impede que a aplicação saiba se o palpite existe ou não — tornando impossível distinguir `OCULTO` de `PENDENTE` sem acesso privilegiado à existência.

A alternativa de função SQL `SECURITY DEFINER` foi considerada, mas rejeitada por adicionar complexidade de migration sem benefício técnico adicional, dado que o Server Component já é zona de confiança.

### Por que a abordagem é segura

1. A query é executada exclusivamente em Server Component (`app/(dashboard)/jogos/page.tsx`), nunca exposta a Route Handler público.
2. A seleção é `select('user_id, game_id')` — sem `home_score`, `away_score` ou qualquer campo de valor.
3. O filtro inclui `group_id = activeGroupId` e `game_id IN (gameIds)`, limitando o escopo ao grupo e ao dia ativo.
4. `hasPrediction` é derivado como `boolean` antes de ser serializado como prop — o Client Component nunca recebe identificadores ou valores de palpite de terceiros.
5. O arquivo `lib/supabase/service-server.ts` é importado apenas em contextos server-side, sem risco de exposição da chave `service_role` ao navegador.

### Conclusão

O uso de service_role nesta feature é uma extensão controlada e justificada da decisão anterior, não uma reversão dela. A diretiva da spec predecessor visava proteger o **conteúdo** dos palpites; esta feature usa service_role apenas para obter a **existência** (booleano), mantendo a privacidade intacta.

---

## Critérios de Aceite

- [ ] Em jogos `pending`, terceiros com palpite exibem `OCULTO` em `color-muted` (cinza)
- [ ] Em jogos `pending`, terceiros sem palpite exibem `PENDENTE` em `color-error` (vermelho)
- [ ] O próprio usuário sempre vê seu palpite real, independentemente do status do jogo
- [ ] Em jogos `live` e `finished`, o comportamento original é mantido (palpites visíveis para todos)
- [ ] A query service_role seleciona apenas `user_id, game_id` — `home_score`/`away_score` de terceiros nunca chegam ao cliente em jogos `pending`
- [ ] `hasPrediction` é populado apenas para membros do grupo ativo (sem vazar dados entre grupos)
- [ ] `lib/supabase/service-server.ts` centraliza o cliente service_role sem duplicação
- [ ] `npm run lint` e `npm run build` passam sem erros novos introduzidos por esta feature
- [ ] A decisão arquitetural de uso de service_role está documentada com justificativa explícita nesta spec
