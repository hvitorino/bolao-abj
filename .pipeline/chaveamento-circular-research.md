# Chaveamento Circular — Plano de Implementação

## Resumo

Transformar o chaveamento horizontal atual em um layout circular/radial usando SVG puro, com a Final e 3º Lugar no centro e as fases anteriores em anéis concêntricos.

## Mudanças

### 1. Criar `components/bolao/CircularBracket.tsx` (novo)

Componente client-side que renderiza o bracket em SVG com viewBox escalável.

**Estrutura de anéis (de fora para dentro):**
- Anel 4 (mais externo): 16 slots — 16 avos de Final
- Anel 3: 8 slots — Oitavas de Final
- Anel 2: 4 slots — Quartas de Final
- Anel 1: 2 slots — Semifinal
- Centro: FINAL (card maior, acima) + 3º Lugar (card normal, abaixo)

**Algoritmo de posicionamento:**
1. Achatar a árvore e agrupar slots por fase
2. Atribuir ângulos às folhas (R32): slot `i` a `(360°/16) × i`, iniciando do topo
3. Subir a árvore: ângulo do pai = média vetorial dos ângulos dos filhos (trata wrap-around em 360°)
4. Converter coordenadas polares `(raio, ângulo)` → cartesianas `(x, y)` para SVG

**Conectores:**
- Linhas retas SVG (`<line>`) de cada filho até o pai
- Traçadas atrás dos cards (renderizadas primeiro)
- Cor: `var(--color-border)`

**Cards:**
- Reutilizar a lógica de `formatTeam`, `formatScore`, `slotStatus`, `winnerCode` do `BracketTree.tsx` (extrair para funções compartilhadas inline ou import)
- Renderizar via `<foreignObject>` do SVG para manter HTML/CSS dos cards
- Card da Final: 180×90px (vs ~140×60px dos demais)
- Card do 3º Lugar: tamanho normal

**Responsividade:**
- SVG com `viewBox="0 0 800 800"` escalando no container
- Container com `max-width: 800px; margin: 0 auto`
- Em telas < 500px: SVG reduz proporcionalmente; cards permanecem legíveis até ~350px

### 2. Atualizar `app/(dashboard)/chaveamento/page.tsx`

- Trocar `import { BracketTree }` → `import { CircularBracket }`
- Trocar `<BracketTree roots={roots} />` → `<CircularBracket roots={roots} />`
- Restante da página (header, fetch de dados) permanece inalterado

### 3. Manter `components/bolao/BracketTree.tsx`

- Arquivo preservado sem alterações (não importado, fácil rollback)

## Testes

- Verificar se todos os 32 slots (16+8+4+2+1+1) são renderizados no SVG
- Verificar se conectores ligam filhos aos pais corretos (R32→R16→QF→SF→Final)
- Verificar se 3º Lugar aparece no centro junto com a Final
- Verificar responsividade em 1920px, 1024px, 768px e 375px
- Verificar se estados dos cards (vazio, pendente, ao vivo, finalizado) funcionam via foreignObject

## Premissas

- Mantém-se a estética retro Elifoot: JetBrains Mono, cores da bandeira brasileira, bordas simples, sem sombras ou curvas decorativas
- Nenhuma biblioteca externa adicional (SVG nativo do React é suficiente)
- O `foreignObject` do SVG funciona corretamente em todos os browsers modernos (suporte universal desde ~2015)
- A estrutura da árvore (`buildBracketTree`) e os tipos (`BracketSlotWithGame`) não mudam
