# Changelog: Refatoração do Daily Recap Modal — Bottom Sheet + Revisão de Badges

**Slug:** daily-recap-modal-refactor
**Branch:** feature/daily-recap-modal-refactor
**Data:** 2026-06-19
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `lib/hooks/useDailyRecap.ts` — refatorado com três mudanças principais:
  1. Tipo `RawPrediction` expandido para incluir `home_score: number` e `away_score: number`.
  2. Tipo `RecapBadge` recebeu campo opcional `secondaryDescription?: string`.
  3. Função `calcBadges` reescrita: de 5 badges (Craque, Vidente, Artilheiro, Apostador, Pé-frio) para exatamente 3 (Craque do Dia, Mãe Diná, Pé-frio). Badge Mãe Diná combina acertos de placar exato (critério primário) com artilharia de palpites (critério secundário via `secondaryDescription`). Fallback para artilharia quando ninguém acerta o placar. Badges Artilheiro e Apostador removidos.
  4. Query de `predictions` expandida para `select('user_id, game_id, home_score, away_score')`.
  5. Mapeamento do resultado de predictions atualizado para propagar `home_score` e `away_score`.
  6. Chamada de `calcBadges` agora recebe o terceiro argumento `predictions`.

- `components/bolao/DailyRecapModal.tsx` — renderização condicional de `secondaryDescription` para o badge `mae_dina`: exibe dois `<div>` separados quando `badge.key === 'mae_dina' && badge.secondaryDescription` for verdadeiro; renderização padrão para os demais badges.

- `components/bolao/RecapFloatingButton.tsx` — componente novo (`'use client'`). Chip fixo em `position: fixed`, `bottom: 1.5rem`, `left: 1.5rem`, `zIndex: 50`. Usa `useDailyRecap(groupId)` e retorna `null` durante loading ou quando `!hasData`. Estilo seguindo DESIGN.md: JetBrains Mono 11px uppercase, background `var(--color-surface)`, borda `1px solid var(--color-border)`, hover muda cor do texto para `var(--color-accent)` e borda para `var(--color-accent)`, sem `border-radius`, sem `box-shadow`. Recebe callback `onOpen` externo (sem estado próprio de abertura do modal).

- `components/bolao/RecapController.tsx` — componente client wrapper novo. Gerencia estado `forceOpen: boolean`. Renderiza `<RecapFloatingButton onOpen={() => setForceOpen(true)} />` e `<DailyRecapModal forceOpen={forceOpen} onClose={() => setForceOpen(false)} />` em uma única árvore — eliminando a dupla instância do modal.

- `app/(dashboard)/nav-links.tsx` — removido import de `RecapButton`, removida prop `<RecapButton />` do JSX, removidas props `groupId` e `currentUserId` da interface `NavLinksProps` e da assinatura da função.

- `app/(dashboard)/layout.tsx` — substituído import de `DailyRecapModal` por `RecapController`. Chamada de `<NavLinks>` sem props. Bloco `<DailyRecapModal>` substituído por `<RecapController groupId={activeGroup.id} currentUserId={user.id} />`.

- `components/bolao/RecapButton.tsx` — arquivo removido (obsoleto, substituído por `RecapFloatingButton` + `RecapController`).

### Backend (Ruby/Sinatra)

Nenhuma alteração. Feature 100% frontend.

### Banco de Dados

Nenhuma migration ou alteração de schema. A única mudança é no `select` da query de `predictions` no cliente Supabase: adicionados campos `home_score` e `away_score`.

---

## Decisões técnicas

**`RecapController` como único ponto de montagem do `DailyRecapModal`:** A spec identificou o risco de dupla instância — o antigo `RecapButton` instanciava seu próprio `DailyRecapModal` separado do que estava no layout. O `RecapController` resolve isso montando o modal exatamente uma vez e controlando o `forceOpen` via estado. A abertura automática (localStorage) permanece intacta dentro do modal, convivendo com a abertura sob demanda via `forceOpen`.

**`RecapFloatingButton` sem estado interno de abertura:** O botão delega a responsabilidade de abrir o modal via callback `onOpen`, sem manter nenhum estado local sobre o modal. Isso evita que o botão precise conhecer a instância do modal — separação clara de responsabilidades.

**Badge Mãe Diná com `secondaryDescription`:** Em vez de concatenar os dois dados em uma única string `description`, optou-se por um campo separado `secondaryDescription` no tipo `RecapBadge`. Isso preserva a pureza do tipo (cada campo tem responsabilidade clara) e permite que o modal decida como renderizar os dois parágrafos sem lógica de parsing de string.

**Fallback de Mãe Diná quando ninguém acerta o placar:** Quando `videntes.length === 0` mas há predictions com dados de score, o badge é emitido com `recipient` baseado no maior apostador de gols e `description` que deixa claro que ninguém acertou o placar. Isso garante que o badge sempre aparece (desde que haja ao menos uma prediction), tornando o resumo mais rico mesmo em dias ruins para o grupo.

**`NavLinks` sem props:** Com a remoção do `RecapButton`, as props `groupId` e `currentUserId` se tornaram desnecessárias em `NavLinks`. A remoção evita propagar informações sem consumidor e simplifica a assinatura do componente.

---

## Pontos de atenção para o Revisor

1. **Dupla instância eliminada**: verificar que apenas um `DailyRecapModal` é montado no DOM quando o dashboard carrega — o do `RecapController`. O antigo `DailyRecapModal` direto no layout foi removido.
2. **Abertura automática preservada**: o `DailyRecapModal` ainda contém o Effect 1 (localStorage) intacto. Confirmar que a abertura automática funciona na primeira visita do dia.
3. **Posicionamento do botão flutuante**: verificar no mobile que o `RecapFloatingButton` (bottom-left) não conflita com o `GroupChatWidget` (bottom-right).
4. **Badge Mãe Diná — fallback sem acertos exatos**: testar o cenário em que `videntes.length === 0` — o badge deve aparecer com base apenas na artilharia, com `description` indicando que ninguém acertou o placar.
5. **Query de predictions com `home_score/away_score`**: confirmar que a tabela `predictions` retorna esses campos corretamente — não há migration envolvida, pois os campos já existem no schema.
6. **Remoção de `NavLinksProps`**: confirmar que nenhum outro ponto da codebase passa `groupId`/`currentUserId` para `NavLinks` (a chamada em `layout.tsx` foi atualizada).
7. **`RecapButton.tsx` removido**: confirmar que nenhum outro arquivo importa `RecapButton` — TypeScript reportaria erro de compilação se houvesse, e `tsc --noEmit` passou sem erros.

---

## Commits realizados

```
aa5a2a6 chore(daily-recap-modal-refactor): remove RecapButton.tsx — substituído por RecapFloatingButton + RecapController
adefe55 feat(daily-recap-modal-refactor): substitui DailyRecapModal direto por RecapController no layout e remove props de NavLinks
03f81d3 feat(daily-recap-modal-refactor): remove RecapButton e props groupId/currentUserId de nav-links
c11237e feat(daily-recap-modal-refactor): cria RecapController gerenciando forceOpen e instância única do DailyRecapModal
3c23e7a feat(daily-recap-modal-refactor): cria RecapFloatingButton fixo no canto inferior esquerdo
7a30e6e feat(daily-recap-modal-refactor): renderiza secondaryDescription para badge mae_dina no modal
280d1d1 feat(daily-recap-modal-refactor): atualiza useDailyRecap com novos badges (Mãe Diná, Pé-frio) e query de predictions com scores
d68f59f chore(daily-recap-modal-refactor): adiciona plano de implementação
```
