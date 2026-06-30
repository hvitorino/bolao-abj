# Changelog: Chaveamento Expansível no Card de Palpites

**Slug:** inline-bracket-expand
**Branch:** feature/inline-bracket-expand
**Data:** 2026-06-30
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/PalpitesLiveCard.tsx` — **feature principal**: adicionado ícone de expandir ⤢/⤡ no cabeçalho do card, visível apenas em dias de mata-mata (fase ≥ 16 avos de Final). Ao expandir, busca dados do bracket lazy (slots + games + predictions), monta a árvore via `buildBracketTree()` e renderiza `BracketTree` inline com scroll horizontal. O `BracketTree` gerencia seu próprio `GameAnaliseDrawer` para cliques nos jogos.
- `lib/hooks/usePalpitesAoVivo.ts` — adicionado campo `phase` à interface `LiveGameWithPrediction` e ao fetch do Supabase
- `app/(dashboard)/palpites/palpites-live-section.tsx` — passa `groupId` e `currentUserId` como props para `PalpitesLiveCard`

### Correções em consumers existentes

- `app/publico/[groupId]/[date]/page.tsx` — adicionado `phase` ao select e mapeamento
- `app/publico/[groupId]/[date]/public-date-client.tsx` — adicionado `phase` ao `GameRaw` e props obrigatórias `groupId`/`currentUserId`

### Banco de Dados

Nenhuma alteração. Reutiliza tabelas existentes (`bracket_slots`, `games`, `predictions`).

---

## Decisões técnicas

1. **Fetch lazy do bracket**: os dados do bracket (31 slots + jogos + palpites) só são buscados ao expandir pela primeira vez. Em expansões subsequentes na mesma sessão, os dados em memória são reutilizados. Isso evita tráfego desnecessário em dias de fase de grupos.

2. **Detecção por `phase` (enum) em vez de `round` (texto)**: mais confiável e tipada. O campo `phase` usa valores do enum `GamePhase` (`'16 avos de Final'`, `'Oitavas de Final'`, etc.), evitando falsos positivos.

3. **BracketTree gerencia seu próprio drawer**: o componente `BracketTree` já renderiza `GameAnaliseDrawer` internamente quando `groupId` e `currentUserId` são fornecidos. Não duplicamos o drawer.

4. **Ícone sem label, apenas caractere Unicode**: ⤢ (U+2922) para expandir e ⤡ (U+2921) para recolher, seguindo a estética ASCII/retro do DESIGN.md. `aria-label` e `aria-expanded` garantem acessibilidade.

---

## Pontos de atenção para revisão

- Verificar se `phase` existe em todos os registros da tabela `games`. Se algum jogo antigo tiver `phase = null`, a detecção de mata-mata falhará silenciosamente (ícone não aparece).
- O ícone ⤢/⤡ pode não renderizar em fontes muito antigas — testar em iOS Safari e Android Chrome.
- O `BracketTree` busca palpites do `currentUserId` ao montar (via prop `predictions`). Após submit no drawer, o BracketTree faz refresh interno — verificar se isso atualiza corretamente as cores dos cards.

---

## Commits realizados

Resultado de `git log main..HEAD --oneline`:

```
91407b2 fix(inline-bracket-expand): adiciona phase e props obrigatórias nos consumers públicos
6e3aeb0 feat(inline-bracket-expand): adiciona chaveamento expansível no card de palpites
c544bcd feat(inline-bracket-expand): adiciona campo phase ao hook usePalpitesAoVivo
6ab3d64 chore(inline-bracket-expand): adiciona plano de implementação
```
