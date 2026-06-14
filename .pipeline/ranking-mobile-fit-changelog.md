# Changelog: Ajuste Mobile do Ranking

**Slug:** ranking-mobile-fit
**Branch:** feature/ranking-mobile-fit
**Data:** 2026-06-14
**Status:** aguardando revisão

---

## O que foi implementado

### Backend (Ruby/Sinatra)

Nenhuma alteração. O endpoint `GET /api/ranking` permanece inalterado.

### Frontend (Next.js/React)

- `app/(dashboard)/ranking/page.tsx` — Removido o bloco `<div>` com `<h1>RANKING GERAL</h1>`, o separador `borderBottom` e o `<p>` de subtítulo. O wrapper externo foi simplificado de `display: flex; flex-direction: column; gap: 1.25rem` para apenas `maxWidth: 800px; margin: 0 auto`, eliminando ~72px de altura em mobile.

- `components/bolao/RankingTable.tsx` — Três ajustes:
  1. Removido `overflowX: 'auto'` do wrapper externo — com a coluna APROVEIT. ocultada em mobile o overflow horizontal não é mais necessário.
  2. Padding de todos os `<th>` do thead reduzido de `0.5rem 0.75rem` para `0.35rem 0.5rem`.
  3. `<th>` da coluna APROVEIT. recebeu `className="hidden md:table-cell"` — oculto em mobile, visível a partir de 768px.

- `components/bolao/RankingRow.tsx` — Três ajustes:
  1. Padding de todos os `<td>` reduzido de `0.5rem 0.75rem` para `0.35rem 0.5rem`.
  2. `<td>` de aproveitamento recebeu `className="hidden md:table-cell"` — oculto em mobile, visível a partir de 768px.
  3. `<td>` do participante recebeu `className="ranking-name-cell"` e o `fontSize: '14px'` inline foi removido (o tamanho agora é controlado pela classe CSS).

- `app/globals.css` — Adicionada regra `.ranking-name-cell` com `font-size: 12px` para mobile e `font-size: 14px` a partir de `@media (min-width: 768px)`. Essa abordagem é necessária pois React não suporta media queries em `style` inline.

### Banco de Dados

Nenhuma alteração.

---

## Decisões técnicas

1. **Reescrita completa de `RankingRow.tsx` em vez de edição parcial:** O arquivo usa aspas curvas em strings template (artefato do histórico de geração), o que causaria falha na ferramenta de edição por diferença de codificação Unicode. A reescrita completa garantiu consistência no arquivo sem risco de conflito.

2. **Classe CSS em `globals.css` para font-size responsivo:** React não suporta `@media` em `style` prop inline. A solução documentada na spec (adicionar classe `.ranking-name-cell` + regra no `globals.css`) foi seguida rigorosamente. É a abordagem mínima sem introduzir dependências adicionais.

3. **Remoção de `overflowX: 'auto'` justificada pela remoção da coluna:** Com apenas 3 colunas em mobile (#, PARTICIPANTE, PONTOS), a tabela cabe na viewport de 375px sem scrollbar horizontal. Em desktop (4 colunas), o `maxWidth: 800px` da page já contém o layout.

4. **Títulos substituídos, não duplicados:** O cabeçalho interno da `RankingTable` já exibe `"RANKING — BOLÃO DO CARTOLA ABJ"` com indicador `● AO VIVO`. Manter o `<h1>RANKING GERAL</h1>` na page.tsx seria redundância de informação além de custo de altura em mobile.

---

## Pontos de atenção para o Revisor

1. **Cálculo de altura pós-ajuste:** Verificar que o somatório das alturas dos elementos em 375x667px com 12 participantes permanece abaixo de 667px. Valores estimados na spec: 68 + 24 + 42 + 30 + (12 × 28) + 30 = 530px — dentro da margem.

2. **Consistência `hidden md:table-cell`:** O `<th>` em `RankingTable.tsx` e o `<td>` em `RankingRow.tsx` devem ter exatamente a mesma classe Tailwind para ocultar/exibir a coluna em sincronia. Verificar que ambos usam `hidden md:table-cell`.

3. **`ranking-name-cell` sem `fontSize` inline:** A célula PARTICIPANTE em `RankingRow.tsx` não possui mais `fontSize` no `style` prop. O tamanho é exclusivamente controlado pela classe CSS `.ranking-name-cell`. Verificar que não há conflito de especificidade.

4. **Desktop inalterado:** Em viewports `>= 768px`, o comportamento deve ser idêntico ao anterior — 4 colunas visíveis, padding compatível, gap antes removido foi inócuo pois havia apenas um filho no flex container.

5. **Ausência de `fontSize` inline no `<td>` do participante:** O `fontSize: '14px'` foi intencionalmente removido do `style` do `<td>` PARTICIPANTE para ceder controle ao CSS. Confirmar que não há outro `font-size` inline herdado que possa sobrescrever a classe.

---

## Commits realizados

```
0630556 feat(ranking-mobile-fit): adiciona regra CSS ranking-name-cell para font-size responsivo
4fb9b16 feat(ranking-mobile-fit): reduz padding das células, oculta APROVEIT. em mobile e adiciona classe ranking-name-cell
0d20161 feat(ranking-mobile-fit): reduz padding do thead e oculta coluna APROVEIT. em mobile
5f58089 feat(ranking-mobile-fit): remove título redundante da página de ranking
f3c8f2a chore(ranking-mobile-fit): adiciona plano de implementação
```
