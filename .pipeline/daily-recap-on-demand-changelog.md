# Changelog: Resumo Diário sob Demanda

**Slug:** daily-recap-on-demand
**Branch:** feature/daily-recap-on-demand
**Data:** 2026-06-19
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/DailyRecapModal.tsx` — refatorado para aceitar `forceOpen?: boolean` e `onClose?: () => void`. Dois effects separados controlam a abertura: o Effect 1 gerencia o comportamento automático via `localStorage` (inalterado), e o Effect 2 responde a `forceOpen === true` sem gravar nem ler o `localStorage`. O `handleClose` agora também chama `onClose?.()`.

- `components/bolao/RecapButton.tsx` — componente novo. Usa `useDailyRecap(groupId)` para verificar disponibilidade de dados. Renderiza `null` durante loading ou quando `hasData === false`. Quando `hasData === true`, exibe o botão `RESUMO DE ONTEM` com estilo idêntico aos `NavLinks` (JetBrains Mono 11px, uppercase, borda inferior em hover com `color-accent`, sem border-radius, sem ícone). Ao clicar, abre `DailyRecapModal` com `forceOpen={recapOpen}` e `onClose={() => setRecapOpen(false)}`.

- `app/(dashboard)/nav-links.tsx` — modificado para aceitar `groupId: string` e `currentUserId: string` como props. Renderiza `<RecapButton>` ao final do `<nav>`, após os links de rota. Adicionado `overflowX: 'auto'` no `<nav>` para compatibilidade mobile.

- `app/(dashboard)/layout.tsx` — passa `groupId={activeGroup?.id ?? ''}` e `currentUserId={user.id}` para `<NavLinks>`. O `activeGroup` e `user` já existiam no componente.

### Backend (Ruby/Sinatra)

Nenhuma alteração. Feature 100% frontend.

### Banco de Dados

Nenhuma migration ou alteração de schema.

---

## Decisões técnicas

**Dois effects separados em `DailyRecapModal`:** A spec considerou e preferiu dois effects independentes — um para abertura automática (controlado por `decidedRef`) e outro para abertura sob demanda (controlado por `forceOpen`). Isso evita a complexidade de resetar `decidedRef` quando `forceOpen` muda e torna a lógica de cada caminho claramente legível.

**`RecapButton` instancia `DailyRecapModal` própria:** O `RecapButton` instancia seu próprio `DailyRecapModal` (separado do que já existe no `DashboardLayout`). Isso resulta em duas chamadas ao `useDailyRecap`, conforme previsto e aceito pela spec (regra de negócio 4). A duplicação é consciente: o `DailyRecapModal` do layout gerencia o comportamento automático; o do `RecapButton` gerencia apenas a abertura sob demanda.

**`currentUserId` em `RecapButton`:** A spec original de `RecapButtonProps` não incluía `currentUserId`, mas `DailyRecapModal` exige a prop para destacar o usuário atual na tabela de ranking. A solução mais limpa foi propagar `currentUserId` do layout até o `RecapButton` via `NavLinks`, evitando que `RecapButton` precise ler o usuário do contexto de forma independente.

**`overflowX: 'auto'` no `<nav>`:** Adicionado conforme critério de aceite de mobile — evita quebra de layout quando o botão é exibido junto com todos os itens de navegação.

---

## Pontos de atenção para o Revisor

1. Verificar que o Effect 2 (`forceOpen`) não interfere com o Effect 1 (automático) — especialmente se `forceOpen` for `true` ao montar o componente (caso improvável, mas possível se o pai renderizar com `recapOpen=true` na montagem inicial).
2. Confirmar que `onClose?.()` é chamado em ambos os caminhos de fechamento: botão FECHAR e clique no backdrop.
3. Verificar alinhamento visual do `RecapButton` com os `NavLinks` existentes — o estilo de hover usa `onMouseEnter/onMouseLeave` em vez de CSS puro; confirmar que não há flickering.
4. Verificar que `NavLinks` sendo `'use client'` (por usar `usePathname`) permite que `RecapButton` (também `'use client'`) seja renderizado sem erros de hidratação.
5. O `DailyRecapModal` do `DashboardLayout` continua com comportamento automático inalterado — verificar que a segunda instância (do `RecapButton`) não interfere no `localStorage`.

---

## Commits realizados

```
5d1c1cf feat(daily-recap-on-demand): passa groupId e currentUserId para NavLinks no DashboardLayout
8bcd0be feat(daily-recap-on-demand): modifica NavLinks para aceitar groupId e currentUserId e renderizar RecapButton
52bfa81 feat(daily-recap-on-demand): cria componente RecapButton com visibilidade condicional
125c2e3 feat(daily-recap-on-demand): refatora DailyRecapModal para aceitar forceOpen e onClose
60d73ba chore(daily-recap-on-demand): adiciona plano de implementação
```
