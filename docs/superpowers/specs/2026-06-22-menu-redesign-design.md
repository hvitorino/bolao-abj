# Design Spec — Reformulação do Menu

**Data:** 2026-06-22
**Status:** Aprovado

## Problema

O menu de topo usa `fontSize: 11px` em todos os links de navegação e áreas de toque sem altura mínima adequada, dificultando a leitura e o tap em celular. Adicionalmente, o `DualFooterBar` (ROLOU ONTEM / TÁ ROLANDO) e o `GroupChatWidget` ocupam o rodapé, deixando o rodapé poluído e sem espaço para navegação principal.

## Solução

Reestruturação completa da navegação em três camadas:

1. **Header compacto** — linha única com logo e grupo ativo
2. **Tab bar no rodapé** — navegação principal com fonte legível e tap target adequado
3. **Pull tabs laterais** — acesso contextual a Ontem, Ao Vivo e Chat via painéis deslizantes

---

## 1. Header (topo)

### Estrutura

De duas linhas passa para **uma linha única**:

```
[ BOLÃO DA COPA ]                    [ ABJ ▼ ]
```

### Especificação

- `position: fixed; top: 0; z-index: 50`
- `padding: 0 1.5rem`
- Altura: ~44px + `env(safe-area-inset-top)`
- Background: `color-surface`
- Borda inferior: `1px solid color-border`

**Logo (esquerda):**
- Texto: `BOLÃO DA COPA`
- Fonte: JetBrains Mono, 14px, bold, uppercase, `letter-spacing: 0.1em`
- Cor: `color-accent`

**Botão do grupo ativo (direita):**
- Mantém comportamento atual do `GroupMenu` (dropdown com troca de grupo, nome do usuário, logout)
- Padding: `0.4rem 0.75rem`
- Fonte: 13px (era 11px)
- Badge de convites pendentes mantido

### Componentes afetados

- `app/(dashboard)/layout.tsx` — remover segunda linha de nav
- `app/(dashboard)/group-switcher.tsx` — aumentar fonte para 13px

---

## 2. Tab Bar (rodapé)

### Estrutura

```
─────────────────────────────────────────
  CAMPANHA    JOGOS    RANKING    MAIS
─────────────────────────────────────────
```

### Especificação

- `position: fixed; bottom: 0; z-index: 50`
- `padding-bottom: env(safe-area-inset-bottom)`
- Altura do conteúdo: 52px
- Background: `color-surface`
- Borda superior: `1px solid color-border`

**Itens:**
- Fonte: JetBrains Mono, **13px**, uppercase, `letter-spacing: 0.05em`
- Cor inativa: `color-muted`
- Cor ativa: `color-primary`
- Indicador ativo: borda superior `2px solid color-primary`
- Altura mínima de toque: 52px (toda a barra)
- Distribuição: `display: flex; justify-content: space-around`

**Itens principais:**

| Label | Rota |
|-------|------|
| CAMPANHA | `/perfil` |
| JOGOS | `/jogos` |
| RANKING | `/ranking` |
| MAIS | — (abre popover) |

**Popover MAIS** (abre para cima ao toque):
- Background: `color-surface`, borda `1px solid color-border`
- Itens: GRUPOS (`/grupos`), REGRAS (`/como-pontuar`), CONFIG (`/configuracoes`)
- Fonte: 13px, padding: `0.75rem 1rem`
- Fecha ao selecionar item ou tocar fora

### Componentes afetados

- `app/(dashboard)/nav-links.tsx` — refatorar para tab bar fixa no rodapé
- `app/(dashboard)/layout.tsx` — ajustar `padding-bottom` do `<main>` para 52px + safe-area

---

## 3. Pull Tabs Laterais

### Estrutura

Três abas verticais fixas na borda direita da tela, centralizadas verticalmente entre o header e a tab bar:

```
                              ┌─────┐
  [conteúdo da página]        │  O  │  ← ONTEM (color-accent)
                              │  N  │
                              │  T  │
                              │  E  │
                              │  M  │
                              ├─────┤
                              │  A  │  ← AO VIVO (color-live, piscando)
                              │  O  │
                              │  V  │
                              │  I  │
                              │  V  │
                              │  O  │
                              ├─────┤
                              │  C  │  ← CHAT (color-primary)
                              │  H  │
                              │  A  │
                              │  T  │
                              └─────┘
```

### Especificação dos Pull Tabs

- `position: fixed; right: 0; z-index: 160` (acima dos painéis para manter visível quando um painel está aberto)
- Posicionamento vertical: `top: 50%; transform: translateY(-50%)` dentro de um container `position: fixed; right: 0; top: var(--header-h, 44px); bottom: var(--tabbar-h, 52px)`
- Largura: 28px
- Background por aba: `color-surface`
- Borda esquerda: `1px solid color-border`
- Texto: `writing-mode: vertical-rl; text-orientation: mixed`
- Fonte: JetBrains Mono, 10px, uppercase, `letter-spacing: 0.1em`

**ONTEM:**
- Cor: `color-accent`
- Visibilidade: só renderiza quando `recapHasData === true`

**AO VIVO:**
- Cor: `color-live`
- Animação: `blink 1s step-end infinite` (mesmo padrão do badge AO VIVO atual)
- Visibilidade: só renderiza quando `hasGamesToday === true`

**CHAT:**
- Cor: `color-primary`
- Visibilidade: sempre visível quando há grupo ativo

### Painéis Expandidos

Ao tocar em qualquer pull tab, o painel correspondente desliza da borda direita:

```
┌──────────────────────────────┬─────┐
│                              │  O  │
│  [conteúdo do painel]        │  N  │
│                              │  T  │
│  [ FECHAR ]                  │  E  │
└──────────────────────────────┤  M  │
                               ├─────┤
                               │ ... │
                               └─────┘
```

**Especificação do painel:**
- `position: fixed; top: var(--header-h, 44px); bottom: var(--tabbar-h, 52px); right: 0; width: 85vw; z-index: 150`
- Os pull tabs ficam em `z-index: 160`, sobrepostos à direita do painel — permanecem visíveis e tocáveis
- Os 15vw restantes à esquerda do painel funcionam como área de fechamento ao toque (backdrop transparente com `z-index: 149`)
- Background: `color-surface`
- Borda esquerda: `1px solid color-border`
- Animação de abertura: `translateX(100%)` → `translateX(0)`, 250ms ease-out
- Animação de fechamento: `translateX(0)` → `translateX(100%)`, 250ms ease-in
- Fechar: toque fora do painel ou botão FECHAR interno
- Pull tabs permanecem visíveis sobre o painel para troca direta entre painéis

**Conteúdo de cada painel:**

| Pull Tab | Painel | Fonte do conteúdo |
|----------|--------|-------------------|
| ONTEM | Resumo do dia anterior (jogos, ranking do dia, destaques) | `RecapBottomSheet` atual |
| AO VIVO | Ranking ao vivo de hoje + jogos em andamento | `LiveTodayBottomSheet` atual |
| CHAT | Chat do grupo ativo | `GroupChatWidget` atual |

A lógica de abertura automática do recap no primeiro acesso do dia (via localStorage) é mantida — ao carregar, se `recapHasData && !shown`, o painel ONTEM abre automaticamente.

### Componentes afetados / novos

- **Novo:** `components/bolao/SidePanelContainer.tsx` — gerencia estado aberto/fechado dos três painéis, renderiza pull tabs e painéis
- **Refatorar:** `RecapBottomSheet` → conteúdo extraído para `components/bolao/RecapPanelContent.tsx` (sem o wrapper de bottom sheet)
- **Refatorar:** `LiveTodayBottomSheet` → conteúdo extraído para `components/bolao/LiveTodayPanelContent.tsx`
- **Refatorar:** `GroupChatWidget` → conteúdo extraído para `components/bolao/ChatPanelContent.tsx`
- **Eliminar:** `DualFooterBar.tsx` — substituído pelos pull tabs ONTEM e AO VIVO
- **Eliminar:** `RecapController.tsx` — lógica migrada para `SidePanelContainer`
- `app/(dashboard)/layout.tsx` — substituir `GroupChatWidget` e `RecapController` por `SidePanelContainer`

---

## Fora de Escopo

- Conteúdo interno dos painéis (recap, live today, chat) — reaproveitado sem alterações
- Lógica de dados (hooks, queries Supabase) — sem mudanças
- Rotas e páginas — sem mudanças
- Tema, cores e tipografia — sem mudanças além dos ajustes de tamanho descritos

---

## Critérios de Aceitação

- [ ] Header ocupa uma linha única em qualquer largura de tela
- [ ] Tab bar fixa no rodapé com 4 itens, fonte 13px, altura 52px
- [ ] MAIS abre popover com GRUPOS, REGRAS, CONFIG
- [ ] Pull tabs visíveis na borda direita, texto vertical, cores corretas
- [ ] ONTEM e AO VIVO aparecem apenas quando há dados relevantes
- [ ] Painel abre com slide da direita em 250ms, fecha ao toque fora
- [ ] Abertura automática do recap no primeiro acesso do dia mantida
- [ ] `DualFooterBar` e `GroupChatWidget` (flutuante) removidos
- [ ] `padding-bottom` do `<main>` ajustado para não ficar atrás da tab bar
- [ ] Safe area respeitada em iOS (header e tab bar)
