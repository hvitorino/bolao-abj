# Changelog: Navegação para Detalhe do Jogo

**Slug:** game-detail-navigation
**Branch:** feature/game-detail-navigation
**Data:** 2026-06-22
**Status:** aprovado

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/BackButton.tsx` — label padrão alterado de `'← VOLTAR AO PALPITE'` para `'← VOLTAR'`. Comportamento de navegação (`router.back()` / `router.push(fallbackHref)`) inalterado.

- `components/bolao/perfil/HistoryPanel.tsx` — cada item do feed de histórico (loop `dayItems.map`) foi convertido de `<div>` para `<Link href={/jogos/${item.game_id}/analise}>`. Adicionado `import Link from 'next/link'`. Estilos mantidos; adicionados `textDecoration: 'none'`, `color: 'inherit'`, `cursor: 'pointer'` para conformidade com DESIGN.md (sem sublinhado, paleta intacta).

- `app/(dashboard)/meus-palpites/page.tsx` — coluna JOGO de cada linha da tabela envolvida com `<Link href={/jogos/${game.id}/analise}>` com `display: 'block'`. Adicionado `import Link from 'next/link'`. Adicionado indicador `► VER ANÁLISE` em `color-primary` abaixo dos metadados do jogo, sinalizando clicabilidade ao usuário.

### Backend (Ruby/Sinatra)
Nenhuma alteração. A feature é puramente de navegação e UI.

### Banco de Dados
Nenhuma alteração. Sem migrations ou novos endpoints.

---

## Decisões técnicas

- **`Link` do Next.js em ambos os componentes**: permite prefetch automático da rota `/jogos/[gameId]/analise` ao hover, melhorando a percepção de velocidade.
- **Sem hover state explícito no HistoryPanel**: o `cursor: 'pointer'` já sinaliza clicabilidade sem necessidade de `useState` para hover — mantém o componente mais simples.
- **Indicador `► VER ANÁLISE` apenas em meus-palpites**: a tabela tem layout mais denso, onde o indicador textual ajuda a diferenciar visualmente a coluna JOGO das demais. No HistoryPanel, o layout inline com `cursor: pointer` é suficiente.
- **Label padrão do BackButton**: verificado que há apenas um uso sem label explícito (na página `/jogos/[gameId]/analise`). Nenhum outro uso depende do padrão anterior.

---

## Pontos de atenção para o Revisor

- Verificar se `Link` no HistoryPanel não quebra o layout `flexWrap: 'wrap'` em mobile — o `display: flex` foi mantido em estilo inline.
- Confirmar que o indicador `► VER ANÁLISE` em meus-palpites não aumenta demais a altura da célula JOGO em mobile (coluna única).
- O `BackButton` na página de análise agora mostra `← VOLTAR` em todos os contextos de chegada (perfil, meus-palpites, jogos direto). Verificar se faz sentido semântico.
- Os erros de lint reportados (`group-switcher.tsx`, `GroupChatWidget.tsx`) são pré-existentes na main e não foram introduzidos por esta feature.

---

## Commits realizados

```
01f00ae feat(game-detail-navigation): torna coluna JOGO clicável em /meus-palpites com indicador VER ANÁLISE
0427c83 feat(game-detail-navigation): torna itens do HistoryPanel clicáveis navegando para /jogos/[id]/analise
b2ea623 feat(game-detail-navigation): altera label padrão do BackButton para '← VOLTAR'
66493f2 chore(game-detail-navigation): adiciona plano de implementação
```
