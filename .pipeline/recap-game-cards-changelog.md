# Changelog: Cards Visuais de Jogos no Recap

**Slug:** recap-game-cards
**Branch:** feature/recap-game-cards
**Data:** 2026-06-19
**Status:** aguardando revisão

---

## O que foi implementado

### Frontend (Next.js/React)

- `components/bolao/RecapBottomSheet.tsx` — substituição do bloco de texto simples na seção "JOGOS DE ONTEM" por cards visuais compactos com layout grid de três colunas (`1fr auto 1fr`). Adicionado import de `getTeamFlag` e `RecapGame`, removido dead code dos estilos `gameRow` e `gameScore`, definido sub-componente interno `RecapGameCard`.

### Backend / Banco de Dados

Sem alterações. Feature puramente de frontend.

---

## Decisões técnicas

- **Tipo de retorno `JSX.Element` omitido:** A anotação explícita de retorno falhou no build com TypeScript 5 + React 19 (JSX automático sem namespace `JSX` global). O padrão no projeto é omitir o tipo de retorno e deixar inferência do TypeScript — alinhado com todos os outros componentes do repositório.

- **Sub-componente definido no mesmo arquivo:** A spec indicou explicitamente que o sub-componente `RecapGameCard` não deveria criar um arquivo separado por ser pequeno demais para justificar. Definido antes do componente principal para que o TypeScript resolva a referência sem `hoisting`.

- **`backgroundColor: 'var(--color-bg)'` no card:** Segue a spec (levemente mais escuro que `color-surface` do painel, criando contraste sutil entre o fundo do bottom sheet e o fundo dos cards).

- **Sem `borderRadius` e sem `boxShadow`:** Conforme DESIGN.md e critérios de aceite da spec.

---

## Pontos de atenção para o Revisor

- Verificar que `RecapGame` é exportado de `lib/hooks/useDailyRecap.ts` (o import de tipo foi adicionado).
- Confirmar que os estilos `gameRow` e `gameScore` foram de fato removidos do objeto `S` (não há mais referências a eles no arquivo).
- Verificar alinhamento visual mobile: o grid `1fr auto 1fr` é naturalmente responsivo e ocupa 100% da largura disponível do container.

---

## Commits realizados

```
707c3d8 feat(recap-game-cards): substitui linha de texto por cards visuais com bandeiras e placar em grid
582764f chore(recap-game-cards): adiciona plano de implementação
```
