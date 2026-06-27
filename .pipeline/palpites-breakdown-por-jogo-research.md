# Pesquisa — Palpites de todos com origem dos pontos (breakdown vertical por jogo)

> Documento do **Explorador**. Descreve a feature, o problema, a direção escolhida (validada
> com o usuário) e o escopo proposto. Entrada para o Gerente de Produto priorizar e acionar
> o Analista de Sistema.

## Slug

`palpites-breakdown-por-jogo`

## Problema

Na aba **Palpites** (`/palpites`), o usuário quer **entender facilmente a origem de cada ponto
registrado** olhando os palpites de **todos os participantes**.

Hoje a aba é centrada no ranking (`PalpitesRanking` → `PalpitesRankingRow`). Ao expandir um
participante, o detalhamento **agrega os pontos por regra** somando todos os jogos
(`buildRuleGroups` em `components/bolao/PalpitesRankingRow.tsx`) e alinha tudo à direita.
Dois problemas:

1. **Origem opaca**: vê-se "Acertou o vencedor +12", mas não de **quais jogos** vieram esses
   pontos, nem o palpite que gerou cada acerto.
2. **Risco de scroll horizontal**: tentar exibir `jogo → palpite → breakdown` numa linha
   horizontal estoura a largura. O app é **mobile-first (~360px)** e scroll lateral é inaceitável.

## Direção escolhida (validada com o usuário)

**Opção: manter o ranking e detalhar jogo a jogo, com breakdown VERTICAL.**

Ao expandir um participante, em vez de pontos agregados por regra, mostrar **um bloco por jogo**
empilhado verticalmente:

```
1 ► VOCÊ                  42 ▲
  ──────────────────────────────
  BRA 2×1 ARG   2×1         +8
    ✓ Acertou vencedor      +3
    ✓ Placar exato          +5
  FRA 0×2 ESP   0×2          0
  ALE 3×0 POR   3×0         +5
    ✓ Acertou vencedor      +3
    ✓ Diferença de gols     +2
```

Cada jogo vira um bloco: uma **linha-cabeçalho** (jogo + palpite daquele participante + total)
e, abaixo e indentadas, as **regras que pontuaram**. Tudo cresce para baixo (scroll vertical
natural), nunca para o lado.

### Decisões fechadas com o usuário

- Direção = **ranking que expande jogo a jogo** (menor mudança estrutural, já mobile-friendly).
- Breakdown **vertical**, não em coluna à direita.
- Mostrar **todos os jogos do dia** no bloco, inclusive os que **zeraram** (só cabeçalho, total `0`).
- O **palpite de cada jogador em cada jogo** aparece na linha-cabeçalho do bloco.

## Comportamento detalhado

- **Cabeçalho do jogo** (recomendado): `CÓDIGO placar_real CÓDIGO · palpite · total`.
  O placar real dá contexto de *por que* pontuou. (Pode-se omitir o placar real para enxugar,
  mas a recomendação é mantê-lo.)
- **Sub-linhas de regra**: uma por regra com pontos > 0; label à esquerda, `+N` à direita
  **dentro da própria linha** (linha curta → sem overflow horizontal). Rótulos de
  `BREAKDOWN_LABELS` (`lib/scoring.ts`).
- **Jogo sem pontos**: apenas o cabeçalho com total `0`, sem sub-linhas.
- **Jogo ao vivo**: total e sub-linhas em `var(--color-live)` com sufixo `*` (provisório),
  usando `liveBreakdown` (já calculado client-side).
- **Privacidade — jogo pendente**: esconder o palpite de **terceiros** em jogo não iniciado
  (mostrar `—`/`PENDENTE`), espelhando `GameParticipantsList.tsx:152-159`. O próprio usuário
  vê o seu palpite pendente. Na prática o RLS já entrega `userPrediction === null` para
  terceiros em jogo pendente (commit `df3817b`); o guard é defesa em profundidade.
- O rótulo "seu" do mockup só vale na linha do próprio usuário; nas demais o cabeçalho mostra
  o palpite **daquele participante**.

## Escopo técnico (alto nível)

- Mudança **puramente de apresentação**, isolada em `components/bolao/PalpitesRankingRow.tsx`.
- **Sem** alteração de schema, RLS, API ou hook de dados.
- Os dados já existem por participante em `participant.games: GameScoreEntry[]`
  (`lib/hooks/usePalpitesAoVivo.ts:29`): `home_team_code`, `away_team_code`, `home_score`,
  `away_score` (placar real), `status`, `userPrediction`, `officialPoints`,
  `officialBreakdown`, `livePoints`, `liveBreakdown`.

### Mudanças previstas em `PalpitesRankingRow.tsx`

1. Substituir o render do accordion (hoje `ruleGroups.map` + `liveGames.map`) por iteração de
   `participant.games`, renderizando **um bloco por jogo**.
2. Novo componente local `GameBreakdownBlock` (substitui `RuleGroupLine`/`LiveGameLine`):
   cabeçalho do jogo + sub-linhas de regra (`officialBreakdown` para finished, `liveBreakdown`
   para live, filtrando `pts > 0` na ordem de `BREAKDOWN_LABELS`).
3. Guard de privacidade para palpite de terceiro em jogo pendente.
4. Ajustar o padding do accordion (hoje `0.35rem 3.5rem 0.35rem 0.75rem`) para usar a largura
   cheia no layout vertical/left-aligned.
5. Remover `buildRuleGroups`, `RuleGroupLine`, `LiveGameLine` e os tipos `RuleGame`/`RuleGroup`.
6. Estado vazio "NENHUM PONTO CONQUISTADO HOJE" só quando o participante não tem nenhum palpite
   no dia.

## Critérios de aceite

1. Em viewport estreito (375px), ao expandir um participante: **sem scroll horizontal**;
   blocos por jogo empilhados verticalmente.
2. Jogo **encerrado**: cabeçalho com placar real + palpite + total; sub-linhas batem com as
   regras (cruzável via MCP `ver_palpites_jogo` / `ver_ranking`).
3. Jogo **ao vivo**: total e sub-linhas em vermelho com `*`, atualizando no polling (10s).
4. Jogo **pendente**: total vazio; palpite do **próprio** usuário visível; de **terceiros**, oculto.
5. Participante **sem palpites no dia**: estado vazio correto.
6. `npm run lint` e `npm run build` sem erros.

## Observações

- Feature pequena e isolada — candidata a implementação direta (sem pipeline pesado), a critério
  do Gerente de Produto.
- Princípio reforçado nesta sessão: **app é mobile-first**; projetar para ~360px e evitar
  qualquer layout que exija scroll horizontal.
