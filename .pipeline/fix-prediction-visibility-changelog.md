# Changelog: Correção — Visibilidade Temporal dos Palpites

**Slug:** fix-prediction-visibility
**Branch:** feature/fix-prediction-visibility
**Data:** 2026-06-14
**Status:** aprovado

---

## O que foi implementado

### Banco de Dados / Segurança

- `supabase/migrations/20260614191000_fix_prediction_visibility_policy.sql`
- `db/migrations/20260614_fix_prediction_visibility_policy.sql`

As migrations substituem a leitura irrestrita de `predictions` por uma policy temporal:

- o próprio usuário continua podendo ler o próprio palpite em qualquer status
- palpites de terceiros só podem ser lidos quando o jogo relacionado já saiu de `pending`

Na prática, isso alinha a camada de dados com a regra de produto: antes do início da partida, o backend não entrega palpites de outros participantes.

### Frontend

- `components/bolao/GameParticipantsList.tsx`

O componente agora aplica a regra também no frontend como defesa em profundidade:

- em jogos `pending`, linhas de outros participantes exibem `OCULTO`
- em jogos `pending`, a própria linha do usuário continua exibindo seu palpite normalmente
- em jogos `live` e `finished`, o comportamento permanece inalterado (`H × A` ou `-`)

### Ajustes técnicos para validação

- `app/(dashboard)/jogos/page.tsx` — troca `participantsByGameId` de `let` para `const` para satisfazer a regra `prefer-const`
- `lib/hooks/useRankingRealtime.ts` — agenda o fetch inicial com `window.setTimeout(..., 0)` e limpa o timer no cleanup, eliminando o erro de lint `react-hooks/set-state-in-effect`

Esses dois ajustes não mudam a regra de negócio da feature, mas foram necessários para que a validação global do projeto (`npm run lint`) passasse.

---

## Decisões técnicas

1. **RLS como primeira barreira:** a principal correção fica na policy de `predictions`, evitando que a aplicação carregue palpites indevidos de terceiros em jogos `pending`.
2. **UI como segunda barreira:** mesmo que um refactor futuro volte a enviar dados além do esperado, `GameParticipantsList` não renderiza o valor do palpite de terceiros quando `gameStatus === 'pending'`.
3. **Regra temporal explícita:** a spec e a implementação tratam `live` e `finished` como o mesmo grupo funcional: jogos que já deixaram o estado `pending`.
4. **Rótulo `OCULTO` em vez de `-`:** evita que a interface sugira falsamente que o outro participante não enviou palpite quando a informação está apenas protegida por regra de visibilidade.

---

## Validação executada

### Comandos

```bash
npm run lint
npm run build
```

### Resultado

- `npm run lint` ✅
- `npm run build` ✅

Build concluído com sucesso em Next.js 16.2.9, incluindo compilação, TypeScript e geração das rotas `/jogos`, `/ranking` e `/meus-palpites`.

---

## Revisão

### Itens revisados

- Diff da branch contra `main`
- Consistência da regra temporal na spec, migrations e UI
- Ausência de bypass por service role na leitura de palpites em `/jogos`
- Regressão visual: jogos `live`/`finished` mantêm exibição normal dos palpites

### Resultado da revisão

- **Aprovado sem solicitações de fix adicional**

---

## Commits realizados

```text
16333d4 fix(fix-prediction-visibility): restringe visibilidade temporal dos palpites
7d7f795 chore(fix-prediction-visibility): adiciona spec e plano
```
