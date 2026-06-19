# Fix 1: Cache LocalStorage e Visual Aprimorado do Recap

**Slug:** recap-cache-visual
**Data:** 2026-06-19
**Rodada de revisão:** 1

---

## Problemas Encontrados

### Problema 1: `nameColor` ignora precedência de amarelo quando usuário atual é o líder
**Arquivo:** `components/bolao/RecapBottomSheet.tsx` (linha ~354)
**Severidade:** menor
**Descrição:** A spec (seção 3.4) define que quando `isCurrentUser && isLeader`, os dois estilos devem ser combinados com o amarelo prevalecendo para a cor do texto do nome. O código atual usa o seguinte ternário:

```typescript
const nameColor = isCurrentUser
  ? 'var(--color-primary)'   // verde — entra aqui mesmo quando isLeader=true
  : isLeader
    ? 'var(--color-accent)'
    : 'var(--color-text)'
```

Quando o usuário atual está em primeiro lugar (`isCurrentUser === true && isLeader === true`), o nome exibe em verde (`var(--color-primary)`) em vez de amarelo (`var(--color-accent)`). O spec diz que amarelo deve prevalecer nesse caso.

**Correção esperada:** Alterar a lógica para que `isLeader` tenha precedência sobre `isCurrentUser` na cor do nome:

```typescript
const nameColor = isLeader
  ? 'var(--color-accent)'    // amarelo — prevalece (inclui caso isCurrentUser && isLeader)
  : isCurrentUser
    ? 'var(--color-primary)' // verde — somente usuário atual não-líder
    : 'var(--color-text)'
```

---

## Itens OK (não precisam ser revisados novamente)

- `lib/hooks/useDailyRecap.ts`: cache hit, background sync, cancelamento por `cancelled`, cache miss com `setLoading(true)`, persistência somente quando `games.length > 0` — tudo correto e alinhado com a spec.
- `getRecapCacheKey()`: formato `bolao_recap_data_YYYY-MM-DD` com data BRT calculada corretamente.
- `app/globals.css`: keyframe `blink` (`0%/100% opacity:1`, `50% opacity:0`) com `step-end` adicionada corretamente.
- `RecapFooterButton.tsx`: fundo verde (`var(--color-primary)`), borda superior `2px solid var(--color-accent)`, texto `var(--color-bg)`, ponto animado `blink` em amarelo, hover via `useState` no container alterando para `#007a2e`.
- `RecapBottomSheet.tsx`: handle renderizado antes do cabeçalho colorido; faixa verde com margem negativa compensando padding; título em `color-accent` 15px bold; `OPENING_MSG` integrado como subtítulo no cabeçalho; `<p style={S.openingMsg}>` removido do corpo; `JOGOS DE ONTEM` em `color-muted` via override; `RANKING DO DIA` e `DESTAQUES` em `color-text`; `<th>` com `borderBottom`; fundo amarelo no líder; fundo verde no usuário atual (não-líder); pontos do líder em 15px bold accent; badges com `borderLeft` verde, `badgeRecipient` 15px bold accent.
- `npm run lint`: sem novos erros introduzidos pela feature (os 2 erros existentes são pré-existentes na main).
- `npm run build`: passa sem erros.
- Assinatura pública do hook `{ data, loading, hasData }` preservada.
- Nenhuma alteração em endpoints Ruby, schema ou migrations.
- Branch `feature/recap-cache-visual`, commits em português com prefixo correto.
