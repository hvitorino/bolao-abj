# Plano de Implementação: Palpite para Todos os Grupos

**Slug:** predict-all-groups
**Branch:** feature/predict-all-groups
**Data:** 2026-06-18
**Spec:** .pipeline/predict-all-groups-spec.md

## Tarefas

- [ ] 1. Criar endpoint `POST /api/predictions/broadcast` (Next.js Route Handler em `app/api/predictions/broadcast/route.ts`) com: autenticação JWT, validação de params, verificação de deadline global, busca de todos os grupos do usuário via `group_members`, loop de UPSERT por grupo com checagem de deadline individual, e resposta com sumário `{ updated_count, results }`.
- [ ] 2. Criar componente `PropagatePrompt` em `components/bolao/PropagatePrompt.tsx` com: estados `idle | loading | done | error`, dois botões ("ESTE GRUPO" / "TODOS OS GRUPOS"), chamada ao endpoint de broadcast, feedback de resultado e fechamento automático após 2s nos estados `done` e `error`.
- [ ] 3. Modificar `PredictionForm` para adicionar estado `'propagating'` ao `FormStatus`, interceptar o fluxo pós-submit bem-sucedido e renderizar `PropagatePrompt` em vez de ir direto para `PredictionDisplay`, passando os callbacks `onChooseSingle` e `onChooseAll`.
- [ ] 4. Ajustar integração no `GameCard`: garantir que o callback `onSuccess` do `PredictionForm` continue funcionando corretamente no novo fluxo (o `PropagatePrompt` chama `onSuccess` após conclusão, não o `PredictionForm` diretamente).
