# Fix 1: Distinção entre Palpite Oculto e Pendente

**Slug:** prediction-visibility
**Data:** 2026-06-17
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Spec formal ausente — plano referencia arquivo inexistente
**Arquivo:** `.pipeline/prediction-visibility-plan.md` (linha 6)
**Severidade:** importante
**Descrição:** O campo `Spec: .pipeline/prediction-visibility-spec.md` referencia um arquivo que nunca foi criado. O pipeline define que o Analista de Sistema deve escrever a spec antes do Programador implementar. Sem spec, não há critérios de aceite formais contra os quais revisar a implementação.
**Correção esperada:** Criar `.pipeline/prediction-visibility-spec.md` com: objetivo, histórias de usuário, critérios de aceite (incluindo os cenários de `OCULTO` vs `PENDENTE`, cores, comportamento em `live`/`finished`), e a decisão arquitetural de usar service_role documentada com justificativa explícita (ver Problema 2).

### Problema 2: Uso de service_role contraria decisão arquitetural da feature predecessor
**Arquivo:** `app/(dashboard)/jogos/page.tsx` (linhas 121, 163–167)
**Severidade:** importante
**Descrição:** A feature `fix-prediction-visibility` foi aprovada com a premissa explícita registrada no changelog (`fix-prediction-visibility-changelog.md`, linha 76): "Ausência de bypass por service role na leitura de palpites em `/jogos`". A spec daquela feature (`.pipeline/fix-prediction-visibility-spec.md`, linha 119) estabeleceu: "Nenhum bypass com service role deve ser introduzido para essa leitura." A implementação atual cria `createServiceClient()` e o usa para contornar o RLS e obter existência de palpites de terceiros em jogos `pending` — exatamente o padrão que foi explicitamente proibido.

A implementação é tecnicamente segura (seleciona apenas `user_id, game_id`, nunca `home_score`/`away_score`), mas representa uma reversão de uma decisão arquitetural aprovada sem que essa reversão tenha passado pelo Analista para avaliação e documentação.

**Correção esperada:** Na spec que será criada (Problema 1), documentar explicitamente:
- A decisão de usar service_role para esta finalidade específica (existência, não conteúdo)
- O motivo pelo qual esta abordagem é segura neste contexto
- A distinção em relação ao que a spec anterior proibia (ler `home_score`/`away_score` de terceiros via service_role vs. ler apenas existência booleana)
- Por que a abordagem alternativa da spec anterior (só RLS) era insuficiente para o novo requisito de distinguir `OCULTO` de `PENDENTE`

A implementação em código pode permanecer como está — o que falta é a documentação e validação formal da decisão arquitetural. Não é necessário reverter o código.

---

## Itens OK (não precisam ser revisados novamente)

- `lib/supabase/service-server.ts` — cliente service_role correto, `persistSession: false`, não exposto ao cliente, reutilizável
- `lib/types/participant.ts` — campo `hasPrediction: boolean` bem tipado com comentário explicativo
- `components/bolao/GameParticipantsList.tsx` — lógica de `predictionLabel` e cores correta:
  - `OCULTO` com `color-muted` (cinza) quando `hasPrediction === true`
  - `PENDENTE` com `color-error` (vermelho) quando `hasPrediction === false`
  - Placar real com `color-accent` (amarelo) quando visível
  - `shouldHidePrediction` garante que o próprio usuário sempre vê seu palpite
- Segurança de dados: `home_score`/`away_score` de terceiros nunca chegam ao Client Component em jogos `pending` (dupla proteção: RLS bloqueia linha inteira + service_role seleciona apenas `user_id, game_id`)
- Escopo da query service_role: filtrada por `group_id = activeGroupId` e `game_id IN (gameIds)`, sem risco de vazar palpites entre grupos
- `hasPrediction` populado apenas para membros do grupo (via `memberProfiles` derivado de `groupMembers`)
- Regressão em `live`/`finished`: `shouldHidePrediction = false` nestes estados, nova lógica não avaliada
- Lint e build: erros pré-existentes (`group-switcher.tsx`, `activeGroupName`, `RankingTable`) são anteriores à feature, não bloqueantes
- Commits em português com prefixo correto (`feat`, `chore`)
- Branch correta (`feature/prediction-visibility`)
- Fonte monospace e paleta de cores respeitadas
- Interface em português brasileiro (`OCULTO`, `PENDENTE`)
