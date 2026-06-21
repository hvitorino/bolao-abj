# Design — Troféus Negativos

Data: 2026-06-21

## Contexto

O sistema de troféus atual possui 15 troféus positivos exibidos no painel de perfil
(`components/bolao/perfil/TrophiesPanel.tsx`), calculados em
`app/api/profile/trophies/route.ts`.

Existe implicitamente o conceito de "platinar" (desbloquear todos os positivos = 15/15).

Este design adiciona 9 troféus negativos com humor leve e autoirônico, todos
colecionáveis por qualquer participante independente de habilidade, mais um
achievement de "anti-platina" para quem coletar todos os negativos.

## Objetivos

- Adicionar 9 troféus negativos ao painel de perfil
- Todos os troféus negativos devem ser atingíveis por bons palpiteiros (situações
  de azar ou comportamento, não de incompetência)
- Tom: humor puro, autoirônico, sem julgamento
- Não bloquear o platina positivo (os negativos são conjunto separado)

## Set de Troféus Negativos (9)

### One-time — destrava na primeira ocorrência

| ID | Nome | Critério de Desbloqueio |
|----|------|------------------------|
| `placar_espelhado` | PLACAR ESPELHADO | Palpitou home×away, resultado real foi away×home (mesmos placares, lados invertidos) |
| `ultima_hora` | ÚLTIMA HORA | Enviou palpite com ≤10 minutos de antecedência ao início do jogo (submitted_at ≥ match_date − 10min) |
| `trono_de_papel` | TRONO DE PAPEL | Estava em 1º lugar num snapshot e em posição > 1 no snapshot seguinte |
| `quase` | QUASE | Acertou o vencedor (breakdown.winner > 0), exact = 0, e ∣pred_home − game_home∣ + ∣pred_away − game_away∣ = 1 |
| `solitario_do_erro` | SOLITÁRIO DO ERRO | Errou o vencedor (breakdown.winner = 0) num jogo em que > 70% dos outros participantes do grupo acertou |
| `dia_ruim` | DIA RUIM | Teve palpites em ≥2 jogos num mesmo dia e não acertou nenhum vencedor (0 acertos de vencedor no dia) |

### Progressivos — têm barra de progresso, espelham Embalado / Em Chamas / Imparável

| ID | Nome | Threshold | Critério |
|----|------|-----------|---------|
| `naufragando` | NAUFRAGANDO | 3 | Sequência de 3 erros de vencedor consecutivos |
| `a_deriva` | À DERIVA | 5 | Sequência de 5 erros de vencedor consecutivos |
| `sem_volta` | SEM VOLTA | 8 | Sequência de 8 erros de vencedor consecutivos |

Os progressivos expõem `progress` e `progress_max` tal como os troféus positivos de
sequência já fazem, usando a mesma lógica de `findStreakUnlockDate` / `findStreakContributingGames`
mas para erros em vez de acertos.

## Achievement: Anti-Platina

Quando todos os 9 troféus negativos estão desbloqueados, exibe um item especial
fixo no topo da seção negativa do painel. Nome sugerido: **COLECIONADOR DO CAOS**.

Não há campo novo no banco — é calculado em runtime: `negatives.every(t => t.status === 'unlocked')`.

## UI

### Localização

Mesmo painel `TrophiesPanel` existente, sem nova aba. Após os 15 troféus positivos,
uma linha divisória com header de seção separa os negativos.

### Visual

- Header da seção negativa: `CONQUISTAS IMPROVÁVEIS` (mesma fonte/tamanho do header atual)
- Troféu negativo **desbloqueado**: texto em `var(--color-error)`, prefixo `✗` (irônico — o ✗ passa a ser de honra)
- Troféu negativo **bloqueado**: texto em `var(--color-muted)`, prefixo `○`
- Contagem no header principal atualiza para mostrar positivos e negativos separadamente:
  `TROFÉUS   12/15 · VERGONHA 3/9`
- Anti-platina aparece no topo da seção negativa como item fixo com borda destacada
  em `var(--color-error)` quando destravado

### Critério exibido (subtexto)

Cada troféu negativo exibe seu critério no mesmo estilo do `TROPHY_CRITERIA` existente:

```
placar_espelhado  → "acertou os números, errou o lado"
ultima_hora       → "não é procrastinação, é estratégia"
trono_de_papel    → "subiu pra cair"
quase             → "tão perto, tão longe"
solitario_do_erro → "o único que não viu"
dia_ruim          → "o sol não saiu hoje"
naufragando       → "sequência de 3 erros consecutivos"
a_deriva          → "sequência de 5 erros consecutivos"
sem_volta         → "sequência de 8 erros consecutivos"
```

## Detecção técnica (route.ts)

Todas as queries rodam em paralelo junto com as existentes via `Promise.all`.

### `placar_espelhado`
```sql
SELECT p.game_id, p.home_score AS ph, p.away_score AS pa,
       g.home_score AS gh, g.away_score AS ga
FROM predictions p JOIN games g ON g.id = p.game_id
WHERE p.user_id = $userId AND p.group_id = $groupId
  AND g.status = 'finished'
  AND p.home_score = g.away_score
  AND p.away_score = g.home_score
ORDER BY g.match_date ASC LIMIT 1
```

### `ultima_hora`
```
predictions WHERE submitted_at >= match_date - interval '10 minutes'
               AND submitted_at < match_date
```
(via Supabase filter ou join com games)

### `trono_de_papel`
Dois snapshots consecutivos via `position_snapshots` com rank_position = 1 seguido de
rank_position > 1. Se não houver snapshots suficientes, fallback: cartola desbloqueado
E posição atual > 1.

### `quase`
Join `scores` + `predictions` + `games`:
```
breakdown->>'winner' > '0'
AND breakdown->>'exact' = '0'
AND ABS(p.home_score - g.home_score) + ABS(p.away_score - g.away_score) = 1
```

### `solitario_do_erro`
Para cada jogo em que o usuário errou, calcular:
- total de palpites no jogo (group_id)
- total de acertos (breakdown.winner > 0)
- se (acertos / total) > 0.70 → destrava

### `dia_ruim`
Agrupar scores por match_day; encontrar dias onde usuário tinha ≥2 palpites e
SUM(breakdown.winner) = 0.

### Sequências negativas (`naufragando`, `a_deriva`, `sem_volta`)
Reutilizar `streakHistory` já buscado, invertendo a lógica:
- winner = 0 → incrementa streak negativa
- winner > 0 → reseta

## Dados novos necessários

Nenhuma migração de banco. Todos os cálculos são derivados das tabelas existentes
(`predictions`, `scores`, `games`, `position_snapshots`).

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `app/api/profile/trophies/route.ts` | Adicionar `calcNegativeTrophies()`, exportar junto com os positivos |
| `components/bolao/perfil/TrophiesPanel.tsx` | Renderizar seção negativa + anti-platina |

## Fora de escopo

- Notificações push ao desbloquear troféu negativo
- Histórico de quando cada troféu negativo foi destravado (unlocked_at exibido normalmente)
- Ranking de "mais vergonhas"
