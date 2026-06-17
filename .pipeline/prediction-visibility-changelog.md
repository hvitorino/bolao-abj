# Changelog: Distinção entre Palpite Oculto e Pendente

**Slug:** prediction-visibility
**Branch:** feature/prediction-visibility
**Data:** 2026-06-17
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Next.js Server Component)
- `app/(dashboard)/jogos/page.tsx` — adicionada quinta query paralela usando `createServiceClient` (service_role) que busca `user_id, game_id` da tabela `predictions` sem expor `home_score`/`away_score`. Monta índice `hasPredictionByUserGame: Set<string>` com chaves `"userId:gameId"`. Popula campo `hasPrediction` em cada `ParticipantEntry` construído no loop.

### Frontend (Next.js/React)
- `components/bolao/GameParticipantsList.tsx` — lógica de `predictionLabel` atualizada para exibir `OCULTO` quando `hasPrediction === true` e `PENDENTE` quando `hasPrediction === false`, em jogos `pending` de outros participantes. Cor da coluna PALPITE corrigida: `OCULTO` usa `color-muted` (cinza), `PENDENTE` usa `color-error` (vermelho), placar real usa `color-accent` (amarelo).

### Utilitários
- `lib/supabase/service-server.ts` — novo arquivo centralizado para instanciar o cliente Supabase com `service_role` em Server Components e Route Handlers. Substitui o padrão inline de `createClient(url, serviceKey)` disperso nos Route Handlers existentes (que continuam funcionando sem alteração, pois o novo arquivo é aditivo).

### Tipos
- `lib/types/participant.ts` — campo `hasPrediction: boolean` adicionado a `ParticipantEntry`.

---

## Decisões técnicas

**Abordagem service_role no Server Component vs. função SQL SECURITY DEFINER:** a spec avaliou ambas e escolheu a abordagem de Server Component (opção 1) por ser mais simples, não requerer migration e centralizar a lógica onde ela já existe. O cliente service_role é instanciado em um novo arquivo `lib/supabase/service-server.ts` para evitar duplicação futura.

**Seleção de colunas `user_id, game_id` apenas:** a query de existência via service_role seleciona explicitamente somente `user_id` e `game_id`, nunca `home_score`/`away_score`. Isso garante que valores de palpite de terceiros em jogos `pending` nunca trafegam para o cliente, mesmo que a serialização de props seja capturada.

**Índice `Set<string>` em vez de `Record`:** usar `Set` com chave composta `"userId:gameId"` é O(1) para lookup e mais semântico do que um dicionário booleano, pois a ausência na chave já indica `false`.

**Pré-existência dos erros de lint:** o erro `react-hooks/immutability` em `group-switcher.tsx` e os 4 warnings de variáveis não utilizadas já existiam na `main` antes desta feature. Nenhum problema novo foi introduzido. `npm run build` passa sem erros de TypeScript.

---

## Pontos de atenção para o Revisor

1. **Segurança:** verificar que a query via service_role seleciona apenas `user_id, game_id` e que `home_score`/`away_score` não aparecem em nenhuma prop serializada para o Client Component `GameParticipantsList` em jogos `pending`.
2. **Regressão em live/finished:** `shouldHidePrediction` permanece `false` nestes estados, então a lógica nova de `hasPrediction` nunca é avaliada e o comportamento é idêntico ao anterior.
3. **Usuário próprio:** `isCurrentUser = p.userId === currentUserId` garante que o usuário logado sempre vê seu próprio palpite, independente de `hasPrediction`.
4. **Lint pré-existente:** confirmar que o único erro de lint (`group-switcher.tsx`) é anterior à feature e não deve ser bloqueante para aprovação desta.
5. **Variável `activeGroupName`:** warning de `no-unused-vars` pré-existente em `jogos/page.tsx` — não introduzido por esta feature.

---

## Commits realizados

```
91aa971 feat(prediction-visibility): distingue OCULTO (color-muted) de PENDENTE (color-error) em GameParticipantsList
8bebf35 feat(prediction-visibility): adiciona query de existência com service_role e popula hasPrediction em jogos/page.tsx
b427688 feat(prediction-visibility): adiciona campo hasPrediction em ParticipantEntry
5df9fa0 feat(prediction-visibility): cria cliente service_role reutilizável em lib/supabase/service-server.ts
c441345 chore(prediction-visibility): adiciona plano de implementação
```
