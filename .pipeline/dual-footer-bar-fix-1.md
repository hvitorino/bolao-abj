# Fix: dual-footer-bar — Channels Supabase Duplicados

## Problema

Após o merge da feature `dual-footer-bar`, a página travava com "This page couldn't load" em produção.

**Causa raiz:** o hook `useLiveTodayRanking` era instanciado duas vezes com o mesmo `groupId`:

1. Em `RecapController` — para obter `hasGamesToday` e controlar a visibilidade do botão "Tá rolando"
2. Em `LiveTodayBottomSheet` — para obter `entries` e `loading` para renderizar o ranking

Como `LiveTodayBottomSheet` é sempre montado no DOM (retorna `null` quando fechado, mas o componente existe), as duas instâncias do hook rodavam ao mesmo tempo. Cada instância criava dois channels Supabase Realtime:

- `live-today-games-${groupId}`
- `live-today-scores-${groupId}`

Isso resultava em **quatro channels com dois pares de nomes duplicados**. O cliente Supabase Realtime não suporta múltiplos channels com o mesmo nome na mesma conexão, causando conflito que travava a página.

## Fix

`useLiveTodayRanking` passa a ser chamado **apenas uma vez**, em `RecapController`. Os dados (`entries`, `loading`) são repassados como props para `LiveTodayBottomSheet`, que deixa de importar o hook.

### Arquivos alterados

- `components/bolao/LiveTodayBottomSheet.tsx` — remove import e chamada do hook; recebe `entries` e `loading` via props
- `components/bolao/RecapController.tsx` — desestrutura `entries` e `loading` do hook e os passa ao `LiveTodayBottomSheet`

## Resultado

- Zero channels duplicados
- Página carrega normalmente em produção
- Comportamento do "Tá rolando" inalterado
