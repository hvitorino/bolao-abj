# Plano de Implementação: Perfil Público do Participante

**Slug:** perfil-participante
**Branch:** feature/perfil-participante
**Data:** 2026-07-13
**Spec:** .pipeline/perfil-participante-spec.md

## Tarefas

- [ ] 1. Configurar infraestrutura mínima de testes unitários (vitest) — o repositório ainda não tem test runner, e a spec exige testes para `lib/participant-profile.ts`
- [ ] 2. Criar `lib/participant-profile.ts` — módulo puro: `inferTeamStyle`, cálculo dos 4 eixos (volume, underdog, calibration, style_reader), seleção do arquétipo (nome + parágrafo), tudo determinístico e sem IA
- [ ] 3. Criar `lib/participant-profile.test.ts` cobrindo os casos de §12 da spec (otimista/cascão, zebreiro/consenso, calibragem vs scoring.ts, leitor de estilo, bordas sem NaN, seleção de arquétipo)
- [ ] 4. Criar `app/api/profile/style/route.ts` — GET autenticado (Bearer JWT), valida UUIDs, valida membership do requisitante no grupo, restringe a jogos `live`/`finished`, monta `ProfileInput` e retorna `ParticipantProfile`
- [ ] 5. Criar `app/(dashboard)/perfil/[userId]/page.tsx` — server component: sessão, grupo ativo, valida que o alvo é membro do grupo ativo (senão renderiza erro no padrão de `/perfil`), busca nome do alvo, delega ao client component
- [ ] 6. Criar `components/bolao/perfil-participante/AxisSpectrum.tsx` — eixo com barra ASCII, stats e selo de amostra pequena
- [ ] 7. Criar `components/bolao/perfil-participante/ArchetypeHeader.tsx` — nome + arquétipo + parágrafo
- [ ] 8. Criar `components/bolao/perfil-participante/ParticipantProfile.tsx` (client) — fetch de `/api/profile/style`, estados loading/error/populated, botão voltar ao ranking
- [ ] 9. Atualizar `components/bolao/RankingRow.tsx` (usado por `RankingTable`) — nome do participante vira link para `/perfil/[userId]` com affordance visível permanente (não só hover), preservando grupo ativo
- [ ] 10. Rodar lint/testes, revisar diff completo, escrever changelog
