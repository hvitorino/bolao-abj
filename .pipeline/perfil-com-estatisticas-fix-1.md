# Fix 1: Perfil com Estatísticas

**Slug:** perfil-com-estatisticas
**Data:** 2026-06-21
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: Label "ACERTO VENCEDOR" diverge da spec
**Arquivo:** `components/bolao/ProfileStats.tsx` (linha 205)
**Severidade:** menor
**Descrição:** O label exibido na linha de estatísticas de acerto de vencedor é `ACERTO VENCEDOR`, mas a spec define explicitamente `ACERTO DE VENCEDOR` — tanto no layout de referência (seção "Layout de exibição") quanto no critério de aceite CA6.
**Correção esperada:** Alterar a linha 205 de:
```tsx
<span style={LABEL_STYLE}>ACERTO VENCEDOR</span>
```
para:
```tsx
<span style={LABEL_STYLE}>ACERTO DE VENCEDOR</span>
```

---

## Itens OK (não precisam ser revisados novamente)

- Migration `20260621400000_create_profile_stats_function.sql`: função `get_profile_stats` implementada identicamente à spec, com `SECURITY DEFINER`, `STABLE`, lógica de gaps-and-islands para `best_streak`, e divisão por zero segura via `COALESCE`.
- Endpoint `GET /api/profile/stats`: autenticação via Bearer JWT, resolução tripla de `group_id` (query param → cookie → fallback por `joined_at ASC`), verificação de membership, `Promise.all` paralelo, `user_id` sempre extraído do JWT (nunca de query param externo). Retorna 401, 403 e 404 nos casos corretos.
- `app/(dashboard)/perfil/page.tsx`: Server Component com proteção de rota, `resolveActiveGroup()` com cookie e fallback, mensagem de erro `✗ VOCÊ NÃO PARTICIPA DESTE GRUPO` em `color-error`.
- `components/bolao/ProfileStats.tsx`: Client Component com estados `loading | error | populated`, fetch com Bearer JWT, layout estilo terminal Elifoot (sem border-radius, sem box-shadow, JetBrains Mono), percentuais em `color-win` >= 50% / `color-muted` < 50%, streaks zero em `color-muted`, exibição de `—` quando `predictions_made = 0`.
- `app/(dashboard)/nav-links.tsx`: item `{ href: '/perfil', label: 'PERFIL' }` adicionado como 7º item, com `overflowX: auto` já presente para scroll horizontal em mobile.
- Build (`npm run build`): compila sem erros novos introduzidos.
- Lint: os 2 erros existentes (`GroupChatWidget.tsx` e `DateChipsNav.tsx`) são pré-existentes — nenhum arquivo com erro de lint foi modificado por esta feature.
- Segurança: sem SQL injection (queries parametrizadas via Supabase client), sem XSS, sem bypass de autenticação, sem credenciais hardcoded.
- Design: paleta de cores, tipografia monospace, estilo Elifoot e interface em português respeitados.
- Supabase Realtime: corretamente não implementado (spec define que a página de perfil é estática).
- Mobile: `flexWrap: 'wrap'` no `ROW_STYLE` e `width: '100%'` no painel garantem funcionamento em 375px sem scroll horizontal.
