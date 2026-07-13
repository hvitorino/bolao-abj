# Changelog: Perfil Público do Participante

**Slug:** perfil-participante
**Branch:** feature/perfil-participante
**Data:** 2026-07-13
**Status:** aprovado

---

## O que foi implementado

### Módulo de cálculo (puro, sem IA)
- `lib/participant-profile.ts` — funções puras, espelhando o padrão de `lib/scoring.ts`:
  - `inferTeamStyle(games)` — infere `offensiveRating`/`defensiveRating` por time a partir de jogos `finished`, exigindo `MIN_GAMES_PER_TEAM` (2) jogos por time.
  - `computeParticipantProfile(input)` — calcula os 4 eixos (`volume`, `underdog`, `calibration`, `style_reader`), seleciona o arquétipo (2 eixos mais extremos entre os `confident`) e monta nome + parágrafo determinísticos.
  - Todas as constantes de limiar/peso (`MIN_SAMPLE_PRED`, `MIN_SAMPLE_FINISHED`, `MIN_TEAMS_FOR_STYLE`, `MIN_GAMES_PER_TEAM`, `BAR_WIDTH`, janelas de normalização, etc.) são `const` nomeadas e comentadas no topo do arquivo.
  - Reusa `calculateScore` de `lib/scoring.ts` no eixo `calibration` para manter coerência com a pontuação oficial.
  - Todo cálculo tem guarda contra divisão por zero/listas vazias — nunca retorna `NaN`/`undefined`.

### Backend (Next.js API Route — o projeto roda em Next.js/TypeScript, não Ruby/Sinatra, conforme já registrado em memória de sessões anteriores)
- `app/api/profile/style/route.ts` — `GET /api/profile/style?group_id=<uuid>&user_id=<uuid>`:
  - Autenticação Bearer JWT (mesmo padrão de `authenticate()` em `app/api/participants-predictions/route.ts`).
  - Valida formato de UUID de `group_id` e `user_id`.
  - Verifica membership do requisitante **e** do alvo no grupo (service-role client) — 403 se o requisitante não é membro, 404 se o alvo não é.
  - Busca `games` com `status IN ('live','finished')` (service-role, tabela global) e `predictions` do grupo com o **JWT do requisitante** (RLS `predictions_select_group_scoped` aplica — nunca retorna palpites de terceiros em jogos `pending`).
  - Filtro explícito adicional em código por `status IN ('live','finished')` antes de repassar ao módulo de cálculo — defesa em profundidade contra o caso em que a RLS deixaria passar os próprios palpites `pending` do requisitante (que seriam descartados de qualquer forma, mas não devem nem entrar no cálculo).
  - Retorna o `ParticipantProfile` já calculado.

### Frontend (Next.js/React)
- `app/(dashboard)/perfil/[userId]/page.tsx` — server component:
  - Redireciona para `/login` se não houver sessão.
  - Resolve grupo ativo via `resolveActiveGroup` + cookie `bolao_active_group` (mesmo padrão de `/perfil` e `/ranking`).
  - Valida que o alvo (`userId` da rota) é membro do grupo ativo; se não for, renderiza `✗ PARTICIPANTE NÃO ENCONTRADO NESTE GRUPO` no mesmo padrão visual de erro de `/perfil`.
  - Busca `name` do alvo em `profiles` e delega ao client component.
- `components/bolao/perfil-participante/ParticipantProfile.tsx` (client) — busca `/api/profile/style` com o `access_token` da sessão (mesmo padrão de `PerfilDashboard`), estados `loading | error | populated`, botão "← Voltar ao Ranking" (reusa `BackButton`).
- `components/bolao/perfil-participante/ArchetypeHeader.tsx` — nome do participante, nome do arquétipo em destaque (`color-accent`) e parágrafo interpretativo.
- `components/bolao/perfil-participante/AxisSpectrum.tsx` — cada eixo como `leftLabel ◄ [barra █/░] ► rightLabel`, stats de apoio abaixo, selo "AMOSTRA PEQUENA" quando `confident=false`.
- `components/bolao/RankingRow.tsx` — o nome do participante virou `<Link href="/perfil/[userId]">`, com affordance visível **permanente** (sublinhado + leve destaque de fundo), não apenas no hover — preserva o grupo ativo implicitamente via cookie (mesma mecânica usada por `/perfil` e demais rotas do dashboard).

### Testes
- `lib/participant-profile.test.ts` — 19 testes unitários cobrindo os casos de §12 da spec: otimista vs. cascão, zebreiro vs. consenso (incluindo empate no consenso), calibragem coerente com `lib/scoring.ts`, leitor de estilo (correlação alta/baixa/clampada), `inferTeamStyle`, bordas sem `NaN`, e seleção de arquétipo (dominância dos 2 eixos + arquétipo neutro "Recém-chegado").
- `vitest.config.ts` + script `npm test` — o repositório ainda não tinha test runner configurado; adicionado `vitest` como devDependency mínima para viabilizar a exigência de testes unitários da spec (critério de aceite 6).

---

## Decisões técnicas

1. **Stack real é Next.js/TypeScript, não Ruby/Sinatra.** O `CLAUDE.md` do repositório descreve `api/*.rb` como backend, mas o código-fonte real usa exclusivamente Next.js API Routes em `app/api/*/route.ts` (confirmado por inspeção de `app/api/participants-predictions/route.ts`, `app/api/profile/performance/route.ts`, etc. — não há nenhuma function Ruby ativa além de alguns `api/*.rb` legados não referenciados pelo build atual). A implementação seguiu o padrão real do projeto (Next.js API Route), não o descrito em `CLAUDE.md`, para ficar consistente com o restante do código.
2. **Setup de testes do zero.** Como não havia test runner no projeto, foi adicionado `vitest` (devDependency mínima, sem browser/DOM environment) e `vitest.config.ts` com alias `@/*` espelhando o `tsconfig.json`. `lib/scoring.ts` também não tinha testes prévios — não foi alterado nem testado nesta feature (fora de escopo), mas `lib/participant-profile.ts` o importa e testa a coerência indiretamente via `calibration`.
3. **Dupla checagem de membership na API.** Além da página validar a membership do alvo (server component), a API `/api/profile/style` repete essa validação (403 requisitante não-membro, 404 alvo não-membro) para não depender exclusivamente da camada de página — a API pode ser chamada diretamente.
4. **Filtro de status em código, além da RLS.** A RLS de `predictions` (`predictions_select_group_scoped`) já impede vazamento de palpites `pending` de terceiros, mas permite que o próprio requisitante veja seus **próprios** palpites `pending` (`user_id = auth.uid()`). Como o contrato de `lib/participant-profile.ts` exige que a entrada contenha apenas jogos `live`/`finished`, a API filtra explicitamente por `game_id` pertencente ao conjunto de jogos `live`/`finished` antes de repassar ao módulo — nunca confia apenas na RLS para esse contrato.
5. **Affordance de link sem `box-shadow`.** DESIGN.md proíbe sombras (`Sem sombras — box-shadow: none`). Para dar affordance permanente e visível de "isto é clicável" no nome do participante (sem depender de hover, conforme a diretriz de mobile do projeto), usei sublinhado (`text-decoration: underline`) com cor `color-muted` + leve tint de fundo (`rgba(240,244,248,0.06)`), em vez do padrão "fundo elevado + box-shadow" — para não violar a regra de "sem sombras" de DESIGN.md.
6. **Preservação do grupo ativo na navegação para `/perfil/[userId]`.** Não foi propagado `?group=` explicitamente no link do `RankingRow` — a página de destino resolve o grupo ativo via `resolveActiveGroup` + cookie `bolao_active_group`, o mesmo mecanismo usado pela navegação existente entre `/ranking`, `/jogos`, `/perfil`, etc. Como o `RankingTable` já opera dentro do grupo ativo corrente (mesmo cookie), a navegação preserva o grupo automaticamente sem necessidade de query param.
7. **Arquétipo: ordem do nome composto.** Segui o padrão dos exemplos da spec (`"Zebreiro Otimista"`, `"Craveiro Cascão"`) colocando o adjetivo do **segundo** eixo dominante primeiro e o do **primeiro** eixo dominante por último no nome — essa ordem reproduziu fielmente os exemplos dados em §7. A tabela de adjetivos/frases por polo (`POLE_TABLE`) foi definida com tom leve, em português, sem inventar números (toda frase injeta apenas valores calculados via `axis.stats`).
8. **`teamStyle` incluído na resposta da API.** Marcado como opcional/debug na spec — mantive no retorno de `computeParticipantProfile` e, por consequência, no JSON de `/api/profile/style`, já que é um subproduto barato do cálculo e pode ser útil para depuração futura sem violar YAGNI (o frontend simplesmente não o renderiza).

---

## Pontos de atenção para o Revisor

- Conferir se a leitura de `CLAUDE.md` sobre stack Ruby/Sinatra é intencionalmente desatualizada (ver decisão técnica #1) — decidi seguir o código real do projeto em vez do documento, mas vale confirmar se essa é a expectativa correta do pipeline.
- Validar que a adição de `vitest` como dependência de desenvolvimento é aceitável neste momento do projeto (não há test runner prévio nem em `lib/scoring.ts`).
- Revisar a interpretação da "moda empatada" no eixo `underdog` (§9 da spec): consenso é calculado com base em **todos** os palpites do grupo para aquele jogo, incluindo o próprio palpite do alvo (não apenas dos "outros"). Isso é consistente com "calculado a partir dos palpites de todos os participantes do grupo" (§3), mas em grupos muito pequenos (2-3 pessoas) o próprio voto do alvo pode influenciar o que conta como "consenso" — vale validar se esse é o comportamento esperado.
- Conferir o texto de erro/estado da API vs. página: a API retorna JSON de erro estruturado (401/403/404/500) enquanto a página usa painéis de erro visuais — o client component (`ParticipantProfile.tsx`) atualmente trata qualquer erro HTTP genericamente como "✗ ERRO AO CARREGAR PERFIL", sem diferenciar 403/404/500 com mensagens específicas. Pode ser um ponto de melhoria, mas não estava explicitamente exigido pela spec para o client component (a validação de "alvo não é membro" já acontece na página server-side antes de chegar ao client).
- Testar visualmente em mobile o affordance do link do nome no ranking (decisão técnica #5) — é uma alternativa ao padrão "fundo elevado + box-shadow" registrado em memória de sessões anteriores, adaptada para respeitar a regra "sem sombras" de DESIGN.md deste projeto.
- Os textos do arquétipo (`POLE_TABLE`) são um ponto de julgo/gosto — o Programador definiu a tabela de adjetivos e frases livremente (autorizado pela spec §7: "o Programador define a tabela de adjetivos por polo"); vale uma leitura de conteúdo/tom.

---

## Commits realizados

```
5acd2c7 feat(perfil-participante): perfil público do participante no ranking
adb5b15 feat(perfil-participante): módulo puro de cálculo do perfil de participante
4168c86 chore(perfil-participante): adiciona plano de implementação
```
