# Changelog: Breakdown Vertical por Jogo nos Palpites

**Slug:** palpites-breakdown-por-jogo
**Branch:** feature/palpites-breakdown-por-jogo
**Data:** 2026-06-27
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/PalpitesRankingRow.tsx` — Refatoração completa do conteúdo do accordion:
  - **Removido:** função `buildRuleGroups`, componentes locais `RuleGroupLine` e `LiveGameLine`, interfaces `RuleGame` e `RuleGroup`, constantes `ruleGroups` e `liveGames`
  - **Adicionado:** componente local `GameBreakdownBlock` que renderiza um bloco vertical por jogo
  - **Accordion:** padding alterado de `'0.35rem 3.5rem 0.35rem 0.75rem'` para `'0.25rem 0.5rem'` para eliminar scroll horizontal em 360px
  - **Estado vazio:** agora dispara somente quando `participant.games.length === 0`, não mais quando não há pontos

### Backend (Ruby/Sinatra)

Nenhuma alteração.

### Banco de Dados

Nenhuma alteração.

---

## Decisões técnicas

**`GameBreakdownBlock` como componente local** — Não criado em arquivo separado porque é exclusivo deste componente-pai e a spec o define como componente local. Mantém coesão e evita exposição desnecessária de API.

**Guard de privacidade em profundidade** — A condição `game.status === 'pending' && !isCurrentUser` no campo palpite defende contra vazamento de dados mesmo que o RLS do Supabase eventualmente retorne um palpite. O RLS já bloqueia (commit `df3817b`); o guard no componente é camada adicional conforme spec.

**Sub-linhas somente com pontos > 0** — A filtragem via `filter((k) => (breakdown[k] ?? 0) > 0)` garante que nenhuma regra com 0 pontos seja exibida, seguindo a spec ao pé da letra.

**Borda inferior em cada `GameBreakdownBlock`** — Adicionada `borderBottom: '1px solid var(--color-border)'` para separar visualmente os blocos de jogos sem usar `gap` no container (que seria suficiente, mas a borda dá clareza visual extra alinhada ao estilo Elifoot).

**Cor do símbolo `✓` nas sub-linhas ao vivo** — Usa `color-live` (vermelho) em vez de `color-win` (verde) para jogos ao vivo, sinalizando que toda a linha é provisória, sem ambiguidade.

---

## Pontos de atenção para o Revisor

1. **Verificar alinhamento em 375px** — O segmento esquerdo (`matchLabel`) tem `overflow: hidden` + `textOverflow: 'ellipsis'` mas o segmento direito (total) é `flexShrink: 0`. Em nomes de time muito longos, o label do meio (palpite) pode ficar apertado — a spec não define truncamento do segmento central.
2. **Estado vazio corrigido** — O estado `NENHUM PONTO CONQUISTADO HOJE` agora só aparece quando `participant.games.length === 0` (sem jogos no dia), não quando há jogos mas zero pontos. Conferir se esta mudança de comportamento está alinhada com a intenção da spec (seção "Estados do Accordion").
3. **Conferir dados ao vivo via polling** — O repoll de 10s já existe no hook; o componente apenas consome. Verificar se a atualização de `liveBreakdown` no `GameBreakdownBlock` de fato reflete os novos valores sem causar flicker.
4. **Lint:** Os 6 erros e 14 warnings reportados pelo ESLint são todos pré-existentes (verificado comparando contra `main`). Nenhum erro novo introduzido por esta feature.

---

## Commits realizados

```
5ad0708 feat(palpites-breakdown-por-jogo): substitui agrupamento por regra por blocos verticais jogo a jogo
942bfb1 chore(palpites-breakdown-por-jogo): adiciona plano de implementação
```

---

## Revisão

**Data:** 2026-06-27
**Resultado:** APROVADO

### Critérios verificados

- **Remoção de artefatos antigos:** `buildRuleGroups`, `RuleGroupLine`, `LiveGameLine`, `RuleGame`, `RuleGroup` ausentes — confirmado via grep sem resultado.
- **`GameBreakdownBlock` implementado:** componente local com interface `{ game: GameScoreEntry; isCurrentUser: boolean }`, conforme spec.
- **Layout mobile (375px):** container usa `flexWrap: 'nowrap'` + `overflow: 'hidden'` — previne scroll horizontal sem quebra de layout.
- **Guard de privacidade:** `game.status === 'pending' && !isCurrentUser` → exibe `—` no campo de palpite. Correto.
- **Jogo encerrado:** usa `officialBreakdown`/`officialPoints`; `color-accent` se N > 0, `color-muted` se N = 0.
- **Jogo ao vivo:** usa `liveBreakdown`/`livePoints`, cor `var(--color-live)`, sufixo `*` no total e em cada sub-linha.
- **Jogo pendente:** `—` no palpite de terceiro e `—` no total; sem sub-linhas.
- **Estado vazio:** dispara somente quando `participant.games.length === 0`.
- **Padding do accordion:** alterado para `'0.25rem 0.5rem'` conforme spec.
- **Sub-linhas:** ordem canônica via `Object.keys(BREAKDOWN_LABELS)` (`winner → exact → winner_score → diff → loser_score → goleada`); filtradas com `> 0`.
- **Fonte monospace:** `JetBrains Mono` declarada tanto na constante `MONO` (linha do componente-pai) quanto no `GameBreakdownBlock`.
- **Lint:** 6 erros e 14 warnings pré-existentes, todos em arquivos não tocados por esta feature — confirmado pelo `git show 5ad0708 --stat` (único arquivo modificado: `PalpitesRankingRow.tsx`).
- **Build:** compilação sem erros.

### Ressalvas não-bloqueantes

- O segmento esquerdo do cabeçalho tem `flexShrink: 0` combinado com `minWidth: 0` (linhas 261-262) — propriedades ligeiramente contraditórias. O `flexShrink: 0` domina, mas o `overflow: hidden` no container pai garante que não haja scroll. Sem impacto funcional em 375px; pode ser simplificado em refatoração futura.
