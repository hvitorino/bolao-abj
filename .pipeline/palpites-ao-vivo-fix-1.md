# Fix 1: Aba de Palpites com Jogos ao Vivo e Ranking

**Slug:** palpites-ao-vivo
**Data:** 2026-06-25
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: `useLayoutEffect` usado para `setInterval` no `NextUpdateCountdown`
**Arquivo:** `components/bolao/PalpitesRanking.tsx` (linha 314)
**Severidade:** menor
**Descrição:** O sub-componente `NextUpdateCountdown` usa `useLayoutEffect` para configurar um `setInterval`. `useLayoutEffect` é destinado exclusivamente a leituras e mutações síncronas do DOM após a fase de commit (ex: medir dimensões, aplicar estilos sincronamente antes da pintura). Usar `useLayoutEffect` para uma subscrição assíncrona como `setInterval` é semanticamente incorreto — o hook certo para esse padrão é `useEffect`. Embora não quebre o funcionamento atual (o componente é Client Component e não há SSR warnings neste contexto), o código está semanticamente errado e pode confundir futuros mantenedores ou causar comportamentos inesperados se o componente for reutilizado em contexto diferente.
**Correção esperada:** Substituir `useLayoutEffect` por `useEffect` no `NextUpdateCountdown` (linha 314 de `components/bolao/PalpitesRanking.tsx`). Ajustar também o import — se `useLayoutEffect` não for mais usado em outro lugar no mesmo arquivo, removê-lo do import. Verificar: o FLIP de ranking usa `useLayoutEffect` na linha 44 corretamente (leitura/mutação DOM síncrona) — esse não deve ser alterado.

---

## Itens OK (não precisam ser revisados novamente)

- Hook `usePalpitesAoVivo`: polling de 10s, constante `POLL_INTERVAL_MS`, cleanup correto, `isFirstFetch` para loading, queries com `group_id` scopadas
- `PalpitesLiveCard`: badge `██ AO VIVO ██` piscante, placar 24px em `color-accent`, "SEM PALPITE REGISTRADO" em `color-error`, scroll horizontal ≥2 jogos, `min-width: 260px`
- `PalpitesRankingRow`: accordion acessível (`role="button"`, `aria-expanded`, `aria-controls`, `role="region"`, `aria-label`), ativação por Enter/Espaço, `►`/`■` para líder/currentUser, `*` em `color-live` para pontos provisórios, filtro `live`/`finished` no breakdown
- `PalpitesRanking`: animação FLIP com `useLayoutEffect` (correto para DOM), `isFirstRender` suprime animação no primeiro render, `capturePositions` antes e depois do FLIP, rodapé com timestamp e `N PARTICIPANTES`
- `palpites/page.tsx`: Server Component, `supabase.auth.getUser()`, resolução de `groupId` idêntica ao `layout.tsx`, redirect para `/grupos` sem grupo ativo
- `palpites-live-section.tsx`: Client Component orquestrador, hook instanciado uma única vez, sticky com `z-index: 10` e `top: calc(44px + env(safe-area-inset-top))`
- `TabBar.tsx`: `PALPITES` entre JOGOS e RANKING, `isPathActive` correto, `fontSize: 12px` e `letterSpacing: 0.04em` para 5 itens
- Divergência documentada de interface `PalpitesRankingProps`: arquitetura com props em vez de `groupId/currentUserId` é superior (evita duplo polling) e está documentada no changelog
- Build e lint: passam sem erros nos arquivos da feature
- Sem credenciais hardcoded; sem SQL injection (tudo via Supabase client)
- Design: JetBrains Mono em todos os componentes, paleta de cores correta, sem sombras, sem border-radius excessivo, interface em português
