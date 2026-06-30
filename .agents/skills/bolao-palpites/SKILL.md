---
name: bolao-palpites
description: Busca palpites de todos os participantes do grupo Cartola ABJ para uma partida específica do bolaodefutebol.com. Use quando o usuário pedir "palpites do jogo X", "quem apostou em quem no jogo Y", ou quiser ver os palpites de uma partida por nome dos times ou match ID.
allowed-tools: Bash
---

# Bolão Palpites

Skill somente leitura que consulta a API do bolaodefutebol.com para listar os palpites de todos os 12 participantes do grupo **Cartola ABJ** (`ba08470f-94e7-4e51-b324-dc65c60c78af`) para uma partida específica.

## Pré-requisito: Token JWT

Antes de qualquer consulta, obter o token JWT do bolaodefutebol.com via Supabase:

```bash
JWT=$(curl -s "https://dyulqyuyjkjmtrgrdkgf.supabase.co/rest/v1/integration_tokens?id=eq.bolaodefutebol&select=token" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dWxxeXV5amtqbXRyZ3Jka2dmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTEwNiwiZXhwIjoyMDk2ODk1MTA2fQ.tEA58wQq5QD7hTpm9UpS_6Eaov6RFrrtwsVsbafsL70" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dWxxeXV5amtqbXRyZ3Jka2dmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTEwNiwiZXhwIjoyMDk2ODk1MTA2fQ.tEA58wQq5QD7hTpm9UpS_6Eaov6RFrrtwsVsbafsL70" \
  | jq -r '.[0].token')
```

> Se o token estiver expirado (erro 401 ou `"try refresh token"`), solicitar ao usuário um novo token capturado via Proxyman/Charles.

## Instructions

### Passo 1: Descobrir o `match_id`

Dependendo do que o usuário informou:

**Caso A — Usuário informou o `match_id` diretamente:**
Pular para o Passo 2.

**Caso B — Usuário informou nomes de times (ex: "France × Sweden"):**
Buscar na lista de partidas e filtrar por nome:

```bash
curl -s "https://bolaodefutebol.com/matches" \
  -H "Authorization: Bearer $JWT" \
  | jq '[.[] | {id, home_team, away_team, start_time, status, home_score, away_score, phase, stage}]'
```

Localizar a partida cujo `home_team` e `away_team` correspondam (case-insensitive, substring matching). Se houver múltiplas correspondências, apresentar as opções ao usuário.

**Caso C — Usuário pediu "o jogo de agora" ou "jogos de hoje":**
Listar partidas com `status: "live"` ou `start_time` de hoje (UTC):

```bash
curl -s "https://bolaodefutebol.com/matches" \
  -H "Authorization: Bearer $JWT" \
  | jq '[.[] | select(.status == "live" or .start_time >= "2026-06-30") | {id, home_team, away_team, start_time, status, home_score, away_score, phase, stage}]'
```

Apresentar as opções para o usuário escolher.

### Passo 2: Buscar os Palpites

Com o `match_id` confirmado, buscar os palpites do grupo:

```bash
curl -s "https://bolaodefutebol.com/matches/{match_id}/predictions?groupId=ba08470f-94e7-4e51-b324-dc65c60c78af" \
  -H "Authorization: Bearer $JWT"
```

**Formato da resposta:**
```json
[
  {
    "id": "prediction-uuid",
    "user_id": "a7501df4-0689-4ac3-a367-3b23c31ea88f",
    "match_id": "ecac9db8-...",
    "group_id": "ba08470f-...",
    "home_score": 2,
    "away_score": 0,
    "predicted_winner": "home",
    "predicted_diff": 2,
    "extra_time_winner_prediction": "draw",
    "penalties_winner_prediction": "home",
    "points_earned": 600,
    "status": "processed",
    "scoring_state": "scored",
    "last_match_version": 40,
    "created_at": "2026-06-30T10:30:35.967507Z",
    "updated_at": "2026-06-30T21:20:20.678236Z"
  }
]
```

### Passo 3: Buscar Detalhes da Partida

Para exibir o contexto:

```bash
curl -s "https://bolaodefutebol.com/matches/{match_id}" \
  -H "Authorization: Bearer $JWT"
```

### Passo 4: Mapear user_id → Nome

Usar o mapeamento:

| user_id | Nome |
|---------|------|
| `7f6249ad-4b2b-4ca1-b298-f078dfc8d03b` | Hamon Vitorino |
| `6e7e3f9a-3456-4296-8c5b-f3b8ef14d103` | David Macedo |
| `ef712a54-8b7b-492f-936b-c38dabc01f8e` | Thiago Brito |
| `8d271d3a-139e-4273-baec-729bfb2dfd1b` | Michel Egidio |
| `0d5d7248-ef8c-460e-a5d3-49997ed3d2fe` | Roberto Sales |
| `08648e5c-81f7-4fcb-a581-ba1c8a2596e0` | Fabio Oliveira |
| `9d4a0595-3e1d-40fc-9715-370c3e072b57` | Henrique Saraiva |
| `a7501df4-0689-4ac3-a367-3b23c31ea88f` | JoaoFilho |
| `4ccdf0db-c9e6-43c2-ad83-ca7507fb0b55` | Civilizado |
| `eba7845b-7895-4a46-bf47-6f87b4dcc44c` | Raimundo Nonato |
| `8e709090-f455-4d03-8308-3e74d55624ad` | Hermes Junior |
| `f197cbe1-3de8-410f-b6ef-03170e16667d` | Josue |

### Passo 5: Apresentar os Palpites

Formato de saída:

```
⚽ PALPITES — France 1 × 0 Sweden (live, first_half)
   Round of 32 | 30/06/2026 18:00 BRT
   🏟️ https://bolaodefutebol.com/matches/ecac9db8-9f90-4fa3-9e26-eb34300a373a

| # | Participante    | Palpite   | Placar | V/D/E | Pts |
|---|-----------------|-----------|--------|-------|-----|
| 1 | Josue           | 2 × 1 🇫🇷  | 1-0 ✅ | V+Dif | 800 |
| 2 | Henrique Saraiva | 2 × 1 🇫🇷  | 1-0 ✅ | V+Dif | 800 |
| 3 | JoaoFilho        | 2 × 0 🇫🇷  | 1-0 ⚡ | V+Dif | 600 |
| 4 | Michel Egidio    | 2 × 0 🇫🇷  | 1-0 ⚡ | V+Dif | 600 |
...
```

**Legenda das colunas:**
- **Palpite**: placar que o participante apostou
- **Placar**: placar real do jogo com indicador (✅ acertou placar exato, ⚡ acertou diferença de gols, 🏆 acertou só o vencedor)
- **V/D/E**: acertos — V (acertou vencedor), D (acertou diferença), E (placar exato)
- **Pts**: `points_earned`

**Ordenação:**
- Por `points_earned` decrescente
- Em caso de empate, ordenar por nome

**Acertos (V/D/E):**
- Calcular comparando `predicted_winner` com o `winner` real da partida
- Se `predicted_diff` == diferença real → acertou diferença (D)
- Se `home_score` e `away_score` batem exatamente → placar exato (E)
- Se `predicted_winner` == `winner` real → vencedor (V)

**Indicador de placar (⚡/✅):**
- ✅ (placar exato): `home_score == match.home_score AND away_score == match.away_score`
- ⚡ (acertou diferença): `predicted_winner == match.winner AND abs(home_score - away_score) == abs(match.home_score - match.away_score)`
- ℹ️ (apenas vencedor): `predicted_winner == match.winner`

**Para partidas que foram aos pênaltis (extra_time_result: "penalties", penalties_winner definido):**
- Mostrar o `extra_time_winner_prediction` e `penalties_winner_prediction` de cada participante
- Adicionar colunas extras: "ET" (prorrogação) e "Pen" (pênaltis)

**Para partidas ao vivo ou ainda não finalizadas:**
- Omitir colunas de acerto (V/D/E) e Pts
- Mostrar apenas os palpites
- Incluir o status da partida no cabeçalho

### Passo 6: Resumo Estatístico (opcional, se partida finalizada)

Ao final, exibir um resumo:

```
📊 Resumo:
   Acertaram o vencedor: 12/12 (100%)
   Acertaram a diferença: 4/12 (33%)
   Acertaram placar exato: 2/12 (17%)
   Média de pontos: 583.3
```

## Script Python de Referência

```python
import json, sys, urllib.request

JWT = sys.argv[1] if len(sys.argv) > 1 else exit("Passe o JWT como argumento")
MATCH_ID = sys.argv[2] if len(sys.argv) > 2 else exit("Passe o match_id como argumento")
GROUP = "ba08470f-94e7-4e51-b324-dc65c60c78af"

USERS = {
    "7f6249ad-4b2b-4ca1-b298-f078dfc8d03b": "Hamon Vitorino",
    "6e7e3f9a-3456-4296-8c5b-f3b8ef14d103": "David Macedo",
    "ef712a54-8b7b-492f-936b-c38dabc01f8e": "Thiago Brito",
    "8d271d3a-139e-4273-baec-729bfb2dfd1b": "Michel Egidio",
    "0d5d7248-ef8c-460e-a5d3-49997ed3d2fe": "Roberto Sales",
    "08648e5c-81f7-4fcb-a581-ba1c8a2596e0": "Fabio Oliveira",
    "9d4a0595-3e1d-40fc-9715-370c3e072b57": "Henrique Saraiva",
    "a7501df4-0689-4ac3-a367-3b23c31ea88f": "JoaoFilho",
    "4ccdf0db-c9e6-43c2-ad83-ca7507fb0b55": "Civilizado",
    "eba7845b-7895-4a46-bf47-6f87b4dcc44c": "Raimundo Nonato",
    "8e709090-f455-4d03-8308-3e74d55624ad": "Hermes Junior",
    "f197cbe1-3de8-410f-b6ef-03170e16667d": "Josue",
}

def api(url):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {JWT}",
        "User-Agent": "bolaodefutebol/1.0",
    })
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# Buscar partida e palpites
match = api(f"https://bolaodefutebol.com/matches/{MATCH_ID}")
preds = api(f"https://bolaodefutebol.com/matches/{MATCH_ID}/predictions?groupId={GROUP}")

is_finished = match["status"] == "finished"
real_diff = abs(match["home_score"] - match["away_score"]) if is_finished else 0

# Ordenar por pontos decrescente
preds.sort(key=lambda p: (-p["points_earned"],
    USERS.get(p["user_id"], p["user_id"])))

# Cabeçalho
status_map = {"finished": "Finalizado", "live": "Ao vivo", "scheduled": "Agendado"}
st = status_map.get(match.get("sub_status") or match["status"], match["status"])
print(f"⚽ PALPITES — {match['home_team']} {match['home_score']} × {match['away_score']} {match['away_team']} ({st})")
print(f"   {match['stage']} | {match['start_time'][:10]} {match['start_time'][11:16]} UTC")
print()

if is_finished:
    print(f"{'Participante':<18} {'Palpite':>6}  {'Placar':>8} {'V/D/E':<6} {'Pts':>5}")
    print("-" * 55)
    for p in preds:
        name = USERS.get(p["user_id"], p["user_id"])
        ps = f"{p['home_score']}×{p['away_score']}"
        exact = (p["home_score"] == match["home_score"] and p["away_score"] == match["away_score"])
        diff_match = (p["predicted_winner"] == match["winner"] and abs(p["home_score"] - p["away_score"]) == real_diff)
        winner_match = (p["predicted_winner"] == match["winner"])

        if exact:
            indicator = "✅"
            vde = "V+D+E"
        elif diff_match:
            indicator = "⚡"
            vde = "V+D"
        elif winner_match:
            indicator = "🏆"
            vde = "V"
        else:
            indicator = "❌"
            vde = "—"

        real_score = f"{match['home_score']}-{match['away_score']} {indicator}"
        print(f"{name:<18} {ps:>6}  {real_score:>8} {vde:<6} {p['points_earned']:>5}")

    # Resumo
    total = len(preds)
    winner_hits = sum(1 for p in preds if p["predicted_winner"] == match["winner"])
    diff_hits = sum(1 for p in preds
                    if p["predicted_winner"] == match["winner"]
                    and abs(p["home_score"] - p["away_score"]) == real_diff)
    exact_hits = sum(1 for p in preds
                     if p["home_score"] == match["home_score"]
                     and p["away_score"] == match["away_score"])
    avg_pts = sum(p["points_earned"] for p in preds) / total if total else 0
    print(f"\n📊 Resumo:")
    print(f"   Acertaram o vencedor: {winner_hits}/{total} ({winner_hits*100//total}%)")
    print(f"   Acertaram a diferença: {diff_hits}/{total} ({diff_hits*100//total}%)")
    print(f"   Acertaram placar exato: {exact_hits}/{total} ({exact_hits*100//total}%)")
    print(f"   Média de pontos: {avg_pts:.1f}")
else:
    print(f"{'Participante':<18} {'Palpite':>6}")
    print("-" * 30)
    for p in preds:
        name = USERS.get(p["user_id"], p["user_id"])
        ps = f"{p['home_score']}×{p['away_score']}"
        print(f"{name:<18} {ps:>6}")
```

## Observações

- **Somente leitura**: esta Skill nunca escreve no Supabase ou no bolaodefutebol.
- **Token**: sempre verificar validade do JWT antes de iniciar. Se expirado, pedir ao usuário um novo.
- **Todos os 12 participantes**: a API de `predictions?groupId=` retorna palpites de todos os membros aprovados do grupo de uma só vez — não é necessário iterar por usuário.
- **Partidas sem palpites**: se o array voltar vazio, significa que nenhum participante apostou nessa partida ainda (ou a partida não pertence ao escopo do bolão).
- **Time zone**: as datas (`start_time`, `created_at`, `updated_at`) estão em UTC. Para converter para BRT, subtrair 3 horas.
