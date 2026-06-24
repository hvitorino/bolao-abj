# Cartola ABJ — Referência de Integração

Documento de referência para importação de dados do **bolaodefutebol.com** para o **bolão ABJ** (Supabase).

## Grupos

| Sistema | Nome | ID |
|---------|------|----|
| bolaodefutebol | Cartola ABJ | `ba08470f-94e7-4e51-b324-dc65c60c78af` |
| bolão ABJ (Supabase) | Cartola ABJ | `49496d29-90d8-49c4-9a04-594c12e760e6` |

> Todos os 12 membros pertencem **exclusivamente** ao grupo Cartola ABJ no bolão ABJ. Os 11 novos usuários (contas `@cartolaabj.com`) não possuem vínculo com nenhum outro grupo. Hamon Vitorino usa conta pré-existente e possui outros grupos independentes que não interferem no Cartola ABJ.

---

## Mapeamento de Usuários

| # | Nome | bolaodefutebol `user_id` | bolão ABJ `user_id` | Email ABJ | Senha |
|---|------|--------------------------|----------------------|-----------|-------|
| 1 | Hamon Vitorino | `7f6249ad-4b2b-4ca1-b298-f078dfc8d03b` | `78fb2471-4c6d-484c-9b0c-ca892c840b72` | *(conta existente)* | — |
| 2 | David Macedo | `6e7e3f9a-3456-4296-8c5b-f3b8ef14d103` | `0f4a1822-c6b7-45bf-bf17-4cdcf5d41791` | david@cartolaabj.com | 123456 |
| 3 | Thiago Brito | `ef712a54-8b7b-492f-936b-c38dabc01f8e` | `41f78c5c-7400-4d9f-9941-abf7a7e8a587` | thiago@cartolaabj.com | 123456 |
| 4 | Michel Egidio | `8d271d3a-139e-4273-baec-729bfb2dfd1b` | `de9f918b-5c05-4d4e-b589-9c59b10e140f` | michel@cartolaabj.com | 123456 |
| 5 | Roberto Sales | `0d5d7248-ef8c-460e-a5d3-49997ed3d2fe` | `9f431d2f-6f4a-4406-ba6c-fdffc15da6e4` | roberto@cartolaabj.com | 123456 |
| 6 | Fábio Oliveira | `08648e5c-81f7-4fcb-a581-ba1c8a2596e0` | `579be633-ee33-4441-a837-fccaf9958b13` | fabio@cartolaabj.com | 123456 |
| 7 | Henrique Saraiva | `9d4a0595-3e1d-40fc-9715-370c3e072b57` | `3e78d6fd-73b8-4982-87db-1328f63edec7` | henrique@cartolaabj.com | 123456 |
| 8 | JoãoFilho | `a7501df4-0689-4ac3-a367-3b23c31ea88f` | `06e4580b-3fc2-4bfc-81fe-25d9b6d0224b` | joao@cartolaabj.com | 123456 |
| 9 | Civilizado | `4ccdf0db-c9e6-43c2-ad83-ca7507fb0b55` | `9ff6e40d-3f9c-4beb-9e17-75a70661ab5b` | civilizado@cartolaabj.com | 123456 |
| 10 | Raimundo Nonato | `eba7845b-7895-4a46-bf47-6f87b4dcc44c` | `b8d4043a-dee3-45f8-b25e-7c053fa4835c` | raimunto@cartolaabj.com | 123456 |
| 11 | Hermes Junior | `8e709090-f455-4d03-8308-3e74d55624ad` | `dc4b4298-3ef0-438f-a021-b2dff6cbf929` | hermes@cartolaabj.com | 123456 |
| 12 | Josué | `f197cbe1-3de8-410f-b6ef-03170e16667d` | `d422db0b-384c-4d32-b3e9-1e690e86ebff` | josue@cartolaabj.com | 123456 |

---

## URLs — bolaodefutebol.com

### Padrão para palpites por partida

```
GET https://bolaodefutebol.com/matches/{bolaofutebol_match_id}/predictions?groupId=ba08470f-94e7-4e51-b324-dc65c60c78af
Authorization: Bearer <token>
```

O token JWT é obtido pelo app mobile (capturar via proxy como Proxyman/Charles). Válido por ~8h.

### Rodada 3 — Fase de Grupos

| # | bolaodefutebol `match_id` | Partida | Horário (UTC) |
|---|--------------------------|---------|---------------|
| 48 | `ef7cd8d5-8ba8-4499-b34b-eca67eb1c640` | Colombia × DR Congo | 2026-06-24T02:00 |
| 49 | `5e4f2061-48d1-49b6-a1e1-fc679229a4ff` | Switzerland × Canada | 2026-06-24T19:00 |
| 50 | `2789bea2-ac8d-4e5b-b187-53f18cb159e4` | Bosnia and Herzegovina × Qatar | 2026-06-24T19:00 |
| 51 | `c0adaf00-0a26-40bc-a8b1-b54b1b4d37ab` | Scotland × Brazil | 2026-06-24T22:00 |
| 52 | `f85cd050-7d09-40fa-9e0e-522e4078bb4f` | Morocco × Haiti | 2026-06-24T22:00 |
| 53 | `e9f4141c-3eab-408f-87ba-28cda5173437` | Czechia × Mexico | 2026-06-25T01:00 |
| 54 | `99911e43-9060-4192-8313-919566a99545` | South Africa × South Korea | 2026-06-25T01:00 |
| 55 | `91165080-5379-41f3-b795-32206fb41e38` | Curacao × Ivory Coast | 2026-06-25T20:00 |
| 56 | `8f5472dd-bfee-47c0-a306-39260f5a400e` | Ecuador × Germany | 2026-06-25T20:00 |
| 57 | `e739b868-0038-4940-8d8f-e19a62a6db21` | Japan × Sweden | 2026-06-25T23:00 |
| 58 | `049d02eb-b954-4a43-bf51-dbf96d56b720` | Tunisia × Netherlands | 2026-06-25T23:00 |
| 59 | `9dd980fe-e26e-4e90-b2d1-d9ad972e0d01` | Turkey × USA | 2026-06-26T02:00 |
| 60 | `418e7b98-92d7-4d9e-9ddc-86af9f4f97a1` | Paraguay × Australia | 2026-06-26T02:00 |
| 61 | `d40ce83f-d992-4c16-b2f4-3f42f8ba520d` | Norway × France | 2026-06-26T19:00 |
| 62 | `9101c18e-c1d6-4171-900b-d8467012cc30` | Senegal × Iraq | 2026-06-26T19:00 |
| 63 | `d457ae94-5137-4bdd-a6d6-787e024c6e60` | Cape Verde × Saudi Arabia | 2026-06-27T00:00 |
| 64 | `451c8be0-e3d8-4b01-9315-5da328c35036` | Uruguay × Spain | 2026-06-27T00:00 |
| 65 | `29115a34-8b19-4585-af80-160d15b34d40` | Egypt × Iran | 2026-06-27T03:00 |
| 66 | `33716ded-7e97-4eac-b472-2105c81663f3` | New Zealand × Belgium | 2026-06-27T03:00 |
| 67 | `04e7964e-79ba-4877-9fba-b84acf76c54d` | Panama × England | 2026-06-27T21:00 |
| 68 | `d0169838-fcf7-47e6-a744-e6c362f9b500` | Croatia × Ghana | 2026-06-27T21:00 |
| 69 | `4dbb57df-27a3-4fd5-96c1-f1aab2b7a1a4` | Colombia × Portugal | 2026-06-27T23:30 |
| 70 | `46d18d4c-99a6-481e-9602-1a7833da5f3f` | DR Congo × Uzbekistan | 2026-06-27T23:30 |
| 71 | `097589c4-5b2b-45fe-a9fe-aedf6170ef0c` | Algeria × Austria | 2026-06-28T02:00 |
| 72 | `d7dacc69-7bc2-4aaa-8e91-5ba7b58ed0af` | Jordan × Argentina | 2026-06-28T02:00 |

> Os `match_id` das Oitavas em diante ainda não são conhecidos — serão obtidos via captura no Proxyman quando os jogos forem agendados no app.

---

## Mapeamento de Partidas — bolaodefutebol → bolão ABJ (Supabase)

As Rodadas 1 e 2 (jogos #1–47) foram importadas de `matches.md`. Os IDs do bolaodefutebol para essas rodadas não foram capturados individualmente — a correspondência foi feita por time/placar.

Para a Rodada 3 em diante, os IDs do bolaodefutebol estão na tabela acima. O `game_id` correspondente no Supabase deve ser consultado em tempo real:

```bash
# Exemplo: buscar ID do jogo Colômbia × Congo no Supabase
curl "https://dyulqyuyjkjmtrgrdkgf.supabase.co/rest/v1/games?select=id,home_team,away_team&home_team=ilike=*col*&status=eq.finished" \
  -H "apikey: <SUPABASE_ANON_KEY>"
```

---

---

## Estratégia de Importação Automática — Rotinas Claude Code

### Visão Geral

As importações de palpites são feitas por **agentes cloud** (Claude Code Routines) que rodam na infraestrutura da Anthropic. Existem dois tipos de rotina:

| Tipo | Frequência | Função |
|------|-----------|--------|
| **One-shot por horário** | Uma vez, 10 min após cada par de jogos simultâneos | Importa os palpites dos 2 jogos do horário |
| **Catch-up diário** | Todo dia às 08:30 BRT (`30 11 * * *` UTC) | Reimporta jogos do dia anterior que estejam sem palpites |

As rotinas ficam em: **https://claude.ai/code/routines**

### Como funciona cada rotina

1. Lê o JWT do bolaodefutebol.com na tabela `integration_tokens` (Supabase)
2. Para cada jogo do lote, chama `GET https://bolaodefutebol.com/matches/{match_id}/predictions?groupId=ba08470f-94e7-4e51-b324-dc65c60c78af`
3. Busca o `game_id` do ABJ no Supabase pelos nomes dos times
4. Converte os `user_id` do bolaodefutebol para os `user_id` do ABJ (mapeamento acima)
5. Faz upsert em `predictions` com `group_id = 49496d29-90d8-49c4-9a04-594c12e760e6`

### Atualização do Token JWT

O token JWT do bolaodefutebol.com é **válido ~8 horas** e obtido via proxy (Proxyman/Charles) no app mobile.

**Quando atualizar:** antes da primeira rodada de jogos de cada dia em que haja rotina agendada.

**Como atualizar:** execute no SQL Editor do Supabase Dashboard:

```sql
INSERT INTO integration_tokens (id, token, notes)
VALUES (
  'bolaodefutebol',
  '<COLE_O_JWT_AQUI>',
  'JWT bolaodefutebol.com — válido ~8h'
)
ON CONFLICT (id) DO UPDATE
  SET token = EXCLUDED.token,
      updated_at = now();
```

> **Tabela:** `integration_tokens` — RLS habilitado, apenas `service_role` acessa.
> O SQL acima deve ser executado no Dashboard (que usa `service_role` internamente).

### Rodada 3 — Rotinas one-shot criadas (jogos #49–72)

| Disparo (UTC) | Disparo (BRT) | Jogos |
|---------------|---------------|-------|
| 2026-06-24T19:10Z | 16:10 | #49 Switzerland×Canada, #50 Bosnia×Qatar |
| 2026-06-24T22:10Z | 19:10 | #51 Scotland×Brazil, #52 Morocco×Haiti |
| 2026-06-25T01:10Z | 22:10 | #53 Czechia×Mexico, #54 S.Africa×S.Korea |
| 2026-06-25T20:10Z | 17:10 | #55 Curacao×Ivory Coast, #56 Ecuador×Germany |
| 2026-06-25T23:10Z | 20:10 | #57 Japan×Sweden, #58 Tunisia×Netherlands |
| 2026-06-26T02:10Z | 23:10 | #59 Turkey×USA, #60 Paraguay×Australia |
| 2026-06-26T19:10Z | 16:10 | #61 Norway×France, #62 Senegal×Iraq |
| 2026-06-27T00:10Z | 21:10 | #63 Cape Verde×Saudi Arabia, #64 Uruguay×Spain |
| 2026-06-27T03:10Z | 00:10 | #65 Egypt×Iran, #66 New Zealand×Belgium |
| 2026-06-27T21:10Z | 18:10 | #67 Panama×England, #68 Croatia×Ghana |
| 2026-06-27T23:40Z | 20:40 | #69 Colombia×Portugal, #70 DR Congo×Uzbekistan |
| 2026-06-28T02:10Z | 23:10 | #71 Algeria×Austria, #72 Jordan×Argentina |

### Oitavas em diante

Os `match_id` do bolaodefutebol para Oitavas, Quartas, Semi e Final ainda não são conhecidos — serão capturados via Proxyman quando os jogos forem agendados no app. Quando disponíveis:

1. Adicionar os `match_id` na tabela acima (seção "Rodada N")
2. Criar novas rotinas one-shot nesta sessão Claude Code (ou nova sessão)

---

## Histórico de Importações

| Data | Rodada | Partidas | Palpites inseridos |
|------|--------|----------|--------------------|
| 2026-06-24 | Rodadas 1 e 2 (jogos #1–47) | 47 | 530 |
| 2026-06-24 | Jogo #48 — Colombia × DR Congo | 1 | 11 |
