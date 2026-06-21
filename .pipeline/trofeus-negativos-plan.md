# Plano de Implementação: Troféus Negativos e Anti-Platina

**Slug:** trofeus-negativos
**Branch:** feature/trofeus-negativos
**Data:** 2026-06-21
**Spec:** .pipeline/trofeus-negativos-spec.md

## Tarefas

- [ ] 1. Refatorar `calcTrophies` em `route.ts`: extrair `streakHistory` para fora da função e passar como parâmetro
- [ ] 2. Implementar constantes e helpers negativos (`NEGATIVE_TROPHY_NAMES`, `NEGATIVE_TROPHY_CRITERIA`, `makeNegativeTrophy`, `calcBestNegativeStreak`, `findNegativeStreakUnlockDate`, `findNegativeStreakContributingGames`) em `route.ts`
- [ ] 3. Implementar `calcNegativeTrophies()` com os 6 troféus não-progressivos (`placar_espelhado`, `ultima_hora`, `trono_de_papel`, `quase`, `solitario_do_erro`, `dia_ruim`)
- [ ] 4. Implementar os 3 troféus progressivos de sequência negativa (`naufragando`, `a_deriva`, `sem_volta`) dentro de `calcNegativeTrophies()`
- [ ] 5. Atualizar o handler `GET` para buscar `streakHistory` uma vez, chamar ambas as funções em `Promise.all` e retornar `{ trophies, negativeTrophies }`
- [ ] 6. Atualizar interface `TrophiesData` em `TrophiesPanel.tsx` para incluir `negativeTrophies: Trophy[]`
- [ ] 7. Atualizar header do painel para exibir `TROFÉUS 12/15 · VERGONHA 3/9`
- [ ] 8. Implementar seção negativa no JSX: divisor, header "CONQUISTAS IMPROVÁVEIS", card Anti-Platina e cards dos 9 troféus negativos com renderização correta (unlocked/locked, barra de progresso com `renderBar`)
- [ ] 9. Adicionar `NEGATIVE_TROPHY_CRITERIA` ao componente e tratar backward compat (`negativeTrophies ?? []`)
- [ ] 10. Verificar e atualizar `PerfilDashboard.tsx` (imports de `TrophiesData`) — nenhuma mudança estrutural esperada, mas confirmar que o fetch continua funcionando com o campo novo
