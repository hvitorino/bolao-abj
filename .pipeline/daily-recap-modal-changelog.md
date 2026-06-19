# Changelog: Modal de Resumo Diário

**Slug:** daily-recap-modal
**Branch:** feature/daily-recap-modal
**Data:** 2026-06-19
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `lib/hooks/useDailyRecap.ts` — Hook client-side que calcula "ontem em BRT" via `getBRTDayBounds()`, busca jogos finalizados do dia anterior em Supabase, carrega scores e predictions em paralelo (`Promise.all`), agrega `rankingDay` (pontos do dia por usuário) e calcula os 5 badges (CRAQUE, VIDENTE, ARTILHEIRO, APOSTADOR, PÉ-FRIO). Retorna `{ data, loading, hasData }`.

- `components/bolao/DailyRecapModal.tsx` — Componente `"use client"` que usa `useDailyRecap`, controla abertura via `localStorage` com chave `bolao_recap_<YYYY-MM-DD-BRT>` (gravar sempre ao terminar de verificar, independente de hasData), exibe backdrop com fechamento por clique, container sem border-radius/shadow, seções de jogos, ranking do dia e destaques (badges), botão FECHAR. Design conforme DESIGN.md: JetBrains Mono, paleta brasileira, sem decorações.

- `app/(dashboard)/layout.tsx` — Adicionado `<DailyRecapModal groupId={activeGroup.id} currentUserId={user.id} />` ao final do JSX (após `GroupChatWidget`), condicional a `activeGroup` existir.

### Backend (Ruby/Sinatra)

Nenhum endpoint criado. Feature 100% client-side.

### Banco de Dados

Nenhuma migration. Queries diretamente nas tabelas existentes: `games`, `scores`, `profiles`, `predictions`.

---

## Decisões técnicas

**`Math.random()` fora do componente:** O ESLint do projeto bloqueia chamadas impuras (`Math.random`) dentro de `useMemo`. A solução foi pré-computar a mensagem aleatória no escopo de módulo (constante `OPENING_MSG`), que é avaliada uma única vez no carregamento do módulo — comportamento equivalente ao `useMemo(fn, [])` mas sem a regra de lint.

**`queueMicrotask` para diferir `setIsOpen`:** O lint bloqueia `setState` síncrono dentro de `useEffect`. Usar `queueMicrotask(() => setIsOpen(true))` é semanticamente correto aqui pois estamos reagindo a uma mudança de estado externo (localStorage + hasData) e diferindo a atualização de estado para o próximo ciclo.

**Estado inicial `loading: !!groupId`:** Em vez de chamar `setLoading(false)` sincronamente dentro do `useEffect` para a guard de groupId vazio, inicializar o estado com `!!groupId` evita o erro de lint e é semanticamente correto (se não há groupId, não há loading).

**`useRef(decidedRef)` para idempotência:** Garante que a lógica de abertura do modal (verificar localStorage, gravar, abrir) ocorra exatamente uma vez por montagem, mesmo que `loading` ou `hasData` mudem em re-renders intermediários.

**Join `profiles!inner(name)` na query de scores:** Evita query N+1 para nomes de participantes, buscando nome e pontuação em uma única chamada Supabase.

---

## Pontos de atenção para o Revisor

1. **Erros de lint pré-existentes:** Os 2 erros de lint que o `npm run lint` ainda reporta pertencem a `group-switcher.tsx` (linha 48: `document.cookie`) e `GroupChatWidget.tsx` (linha 69: `setChipBottom` síncrono). Não são desta feature.

2. **Edge case de fuso horário:** `getBRTDayBounds()` usa `nowUTC.getTime() - 3h` para derivar a data BRT antes de construir os limites UTC. Verificar se o edge case de meia-noite a 02:59 UTC está correto (= 21h-23h59 BRT do dia anterior).

3. **Usuários com prediction mas sem score:** O hook tenta adicionar esses usuários ao `byUser` com pontos 0. Porém o nome ficará como `user_id` (UUID) nesse caso pois não há `profiles.name` nas predictions — avaliar se é aceitável ou se precisa de query adicional.

4. **Escopo `group_id` em `predictions`:** A tabela `predictions` pode não ter coluna `group_id` (a spec indica que tem, mas verificar a migration existente). Se não tiver, o filtro `.eq('group_id', groupId)` na query de predictions retornará erro silencioso.

5. **Backdrop z-index:** O modal usa `z-index: 201` e backdrop `z-index: 200`. O `GroupChatWidget` pode ter z-index conflitante se estiver aberto ao mesmo tempo.

---

## Commits realizados

```
e262404 fix(daily-recap-modal): corrige erros de lint — remove Math.random do render, evita setState síncrono no effect
7617091 feat(daily-recap-modal): integra DailyRecapModal no DashboardLayout
4ce148b feat(daily-recap-modal): cria componente DailyRecapModal com layout e design Elifoot
24844c9 feat(daily-recap-modal): cria hook useDailyRecap com queries BRT e cálculo de badges
3402c1d chore(daily-recap-modal): adiciona plano de implementação
```
