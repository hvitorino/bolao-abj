# Changelog: Troféus Negativos e Anti-Platina

**Slug:** trofeus-negativos
**Branch:** feature/trofeus-negativos
**Data:** 2026-06-21
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Next.js API Route)

- `app/api/profile/trophies/route.ts` — Refatorado e expandido:
  - `streakHistory` extraído do interior de `calcTrophies` para o handler `GET`, evitando query duplicada
  - `calcTrophies` atualizada para receber `streakHistory` como parâmetro
  - Adicionadas constantes `NEGATIVE_TROPHY_NAMES` e helper `makeNegativeTrophy`
  - Adicionados helpers de sequência negativa: `calcBestNegativeStreak`, `findNegativeStreakUnlockDate`, `findNegativeStreakContributingGames`
  - Nova função `calcNegativeTrophies(sc, groupId, userId, streakHistory)` implementando os 9 troféus negativos:
    - `placar_espelhado` — filtro JS pós-query detectando placares trocados (exclui empates)
    - `ultima_hora` — janela de 10 min antes do início detectada em JS via milissegundos
    - `trono_de_papel` — varredura de pares de snapshots consecutivos; fallback para ranking atual quando há apenas 1 snapshot
    - `quase` — soma de diferenças absolutas = 1, com `winner > 0` e `exact = 0`
    - `solitario_do_erro` — queries sequenciais por jogo (análogo a `zebreiro`), threshold `> 70%`
    - `dia_ruim` — agrupamento por `match_day` em Map, mínimo 2 jogos, todos `winner = 0`
    - `naufragando` — threshold 3 na sequência negativa
    - `a_deriva` — threshold 5
    - `sem_volta` — threshold 8
  - Handler `GET` agora usa `Promise.all([calcTrophies, calcNegativeTrophies])` e retorna `{ trophies, negativeTrophies }`

### Frontend (Next.js/React)

- `components/bolao/perfil/TrophiesPanel.tsx` — Atualizado:
  - Interface `TrophiesData` expandida com `negativeTrophies: Trophy[]`
  - `NEGATIVE_TROPHY_CRITERIA` adicionado ao componente
  - Header do painel atualizado para `TROFÉUS N/15 · VERGONHA N/9`
  - Backward compat: `negativeTrophies ?? []` para respostas sem o campo
  - Seção "CONQUISTAS IMPROVÁVEIS" renderizada após divisor, somente quando `negativeTrophies.length > 0`
  - Card "COLECIONADOR DO CAOS" (Anti-Platina) exibido no topo da seção negativa quando todos os 9 estão desbloqueados — borda `color-error`, fundo levemente tingido
  - Cards negativos desbloqueados: prefixo `✗`, cor `color-error`, data em `color-error`
  - Cards negativos bloqueados: prefixo `○`, cor `color-muted`
  - `ContributingGameLine` nos negativos sempre com `unlocked={false}` (borda `color-border`, cor `color-muted`)
  - Barra de progresso nos progressivos (naufragando/a_deriva/sem_volta) com `renderBar` em cor `color-muted`

### Banco de Dados

- Nenhuma migração. Todos os troféus são calculados a partir das tabelas existentes (`predictions`, `scores`, `games`, `position_snapshots`).

---

## Decisões técnicas

- **`streakHistory` extraído para o GET handler:** a spec exige que a query não seja duplicada. A solução foi mover a busca para fora de `calcTrophies` e passá-la como parâmetro para ambas as funções. Isso também permite que `Promise.all([calcTrophies, calcNegativeTrophies])` seja usado com segurança.

- **`solitario_do_erro` com queries sequenciais:** seguindo o padrão já estabelecido por `zebreiro`, que faz queries sequenciais por jogo. Para o tamanho do bolão (grupo pequeno, < 20 jogadores), o custo é aceitável.

- **`placar_espelhado` com filtro JS:** o Supabase não suporta filtro cross-column nativo (`pred.home = game.away`), então a filtragem é feita em JS após buscar até 50 predictions. Eficiente para o volume esperado.

- **`dia_ruim` usa apenas `scores` (não `predictions`):** seguindo a spec, que diz "mínimo de 2 palpites em jogos finalizados". A query em `scores` já garante que o jogo está contabilizado (score existe apenas para jogos finalizados com prediction).

- **Card Anti-Platina com `border` inline sobre padding:** a spec especifica `border: '1px solid var(--color-error)'` no card inteiro (diferente dos outros cards que usam `borderBottom`). Implementado conforme spec.

---

## Pontos de atenção para o Revisor

1. **Refatoração de `calcTrophies`:** confirmar que `streakHistory` passado como parâmetro é equivalente ao que era buscado internamente — mesma query, mesmo `.order('calculated_at', { ascending: true })`, sem filtros adicionais.

2. **`placar_espelhado` — empate:** verificar que a condição `gameHome === gameAway` antes da verificação de espelho é correta. O caso `pred 1×2, resultado 2×1` deve ser detectado; o caso `pred 1×1, resultado 1×1` não deve (ambos têm `home_score = away_score` do jogo, então a guarda funciona).

3. **`ultima_hora` — filtra jogos de qualquer status:** a query não filtra por `status = 'finished'`. Isso é intencional: um palpite de última hora conta independente do resultado do jogo. Se o revisor preferir filtrar apenas finalizados, pode ser ajustado.

4. **`trono_de_papel` — fallback com 1 snapshot:** quando há exatamente 1 snapshot com `rank_position = 1`, faz uma query adicional em `get_ranking`. Isso adiciona latência no caso raro. Alternativa seria ignorar o fallback e só detectar quando há ≥ 2 snapshots.

5. **`dia_ruim` — campo `match_day`:** a query usa `games!inner(match_day, ...)`. Confirmar que a coluna `match_day` existe em `games` com esse nome exato (já usado em `perfeito_na_rodada` em `calcTrophies`, então deve estar correto).

6. **Backward compat:** `const negativeTrophies = state.data.negativeTrophies ?? []` — verificar que `TrophiesData.negativeTrophies` com `?` opcional seria mais correto do que `[]` como default. A interface foi declarada como required, mas o `??` no destructuring garante que cache antigo não quebre.

---

## Commits realizados

```
aaa0750 chore(trofeus-negativos): adiciona plano de implementação
eb18040 feat(trofeus-negativos): implementa calcNegativeTrophies com 9 troféus e refatora streakHistory
43bce16 feat(trofeus-negativos): atualiza TrophiesPanel com seção de conquistas improváveis e Anti-Platina
```
