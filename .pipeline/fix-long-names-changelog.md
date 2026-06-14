# Changelog: Correção — Nomes Longos nos Cards de Jogo

**Slug:** fix-long-names
**Branch:** feature/fix-long-names
**Data:** 2026-06-14
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/games/GameCard.tsx` — Correção de truncamento de texto em três pontos do componente:
  1. **Time da casa (container):** adicionado `minWidth: 0` na div da coluna `1fr` do grid, necessário para que o browser respeite o tamanho da coluna e não expanda além do espaço disponível.
  2. **Nome do time da casa:** adicionados `overflow: 'hidden'`, `textOverflow: 'ellipsis'` e `whiteSpace: 'nowrap'` na div que exibe `liveGame.home_team`.
  3. **Time visitante (container):** adicionado `minWidth: 0` na div da coluna `1fr` do grid pelo mesmo motivo.
  4. **Nome do time visitante:** adicionados `overflow: 'hidden'`, `textOverflow: 'ellipsis'` e `whiteSpace: 'nowrap'` na div que exibe `liveGame.away_team`.
  5. **Venue no footer:** adicionado `minWidth: 0` no span do estádio — o span já tinha as propriedades de truncamento, mas por ser item flex precisava de `minWidth: 0` para respeitar o `maxWidth: 160px` e não "empurrar" o layout em casos extremos.

### Backend (Ruby/Sinatra)

Nenhuma alteração. Esta feature é puramente de frontend.

### Banco de Dados

Nenhuma alteração. Sem migrations ou políticas RLS.

---

## Decisões técnicas

- **`minWidth: 0` no container do grid:** Em CSS Grid, elementos `1fr` têm tamanho mínimo implícito baseado no conteúdo (`min-content`). Sem `minWidth: 0`, o browser pode expandir a célula além do `1fr` para acomodar texto longo, tornando o `overflow: hidden` do filho ineficaz. Esta é a correção padrão para truncamento de texto dentro de grid items.
- **`minWidth: 0` no venue (flex item):** O mesmo princípio se aplica a itens flex — o tamanho mínimo implícito impede que `whiteSpace: 'nowrap'` + `overflow: 'hidden'` funcionem corretamente sem `minWidth: 0` no elemento.
- **Código de 3 letras não é truncado:** Os códigos `home_team_code` e `away_team_code` têm sempre exatamente 3 caracteres (campo `char(3)` no banco), portanto não precisam de truncamento.
- **`title` HTML não adicionado:** Conforme spec, o nome completo do time é texto secundário — o código de 3 letras já identifica o time de forma inequívoca.

---

## Pontos de atenção para o Revisor

- Confirmar que `minWidth: 0` nas divs dos times não afeta o alinhamento do placar central (que tem `minWidth: '80px'` explícito e coluna `auto`).
- Confirmar que o truncamento funciona em telas móveis (320px–375px), onde as colunas `1fr` são especialmente estreitas.
- Confirmar que os códigos de 3 letras (BRA, CIV, etc.) continuam exibidos completos — eles não têm propriedades de truncamento.
- O footer do card usa `flexWrap: 'wrap'` — verificar se a adição de `minWidth: 0` no venue é suficiente ou se o `flexWrap` pode causar quebra de linha em algum cenário não coberto.

---

## Commits realizados

```
d0eb29e fix(fix-long-names): adiciona truncamento e minWidth nos nomes de times e venue do GameCard
b111a58 chore(fix-long-names): adiciona plano de implementação
```
