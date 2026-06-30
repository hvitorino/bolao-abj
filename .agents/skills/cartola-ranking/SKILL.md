---
name: cartola-ranking
description: Calcula a pontuação atualizada do grupo Cartola ABJ somando os pontos do leaderboard com a pontuação diária de cada participante. Use quando precisar gerar ranking atualizado, somar pontuação do dia, ou consultar a classificação do bolão via bolaodefutebol.com.
allowed-tools: Bash
---

# Cartola Ranking

Skill somente leitura que consulta as APIs do bolaodefutebol.com para calcular a pontuação atualizada do grupo **Cartola ABJ** (`ba08470f-94e7-4e51-b324-dc65c60c78af`).

## Pré-requisito: Token JWT

Antes de qualquer consulta, obter o token JWT do bolaodefutebol.com:

```bash
JWT=$(curl -s "https://dyulqyuyjkjmtrgrdkgf.supabase.co/rest/v1/integration_tokens?id=eq.bolaodefutebol&select=token" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dWxxeXV5amtqbXRyZ3Jka2dmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTEwNiwiZXhwIjoyMDk2ODk1MTA2fQ.tEA58wQq5QD7hTpm9UpS_6Eaov6RFrrtwsVsbafsL70" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5dWxxeXV5amtqbXRyZ3Jka2dmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTMxOTEwNiwiZXhwIjoyMDk2ODk1MTA2fQ.tEA58wQq5QD7hTpm9UpS_6Eaov6RFrrtwsVsbafsL70" \
  | jq -r '.[0].token')
```

> Se o token estiver expirado, solicitar ao usuário um novo token capturado via Proxyman/Charles.

## Instructions

### Passo 1: Buscar o Leaderboard

O leaderboard contém a pontuação total e ranking de cada participante no bolaodefutebol:

```bash
curl -s "https://bolaodefutebol.com/groups/ba08470f-94e7-4e51-b324-dc65c60c78af/leaderboard?limit=1000&tiebreaker=true" \
  -H "Authorization: Bearer $JWT"
```

**Formato da resposta:**
```json
{
  "entries": [
    {
      "user_id": "08648e5c-...",
      "user_name": "Fábio Oliveira",
      "total_points": 28200,
      "rank": 1,
      "tiebreaker_stats": {
        "winner_count": 47,
        "exact_score_count": 10,
        "winner_goals_count": 14,
        "goal_diff_count": 22,
        "loser_goals_count": 12,
        "goleada_count": 5
      }
    }
  ]
}
```

### Passo 2: Buscar Palpites de Cada Participante

Para cada um dos 12 participantes, consultar os palpites e somar a pontuação do dia:

```bash
# Exemplo para Hamon Vitorino
curl -s "https://bolaodefutebol.com/users/7f6249ad-4b2b-4ca1-b298-f078dfc8d03b/predictions?groupId=ba08470f-94e7-4e51-b324-dc65c60c78af" \
  -H "Authorization: Bearer $JWT"
```

**Mapeamento de usuários (bolaodefutebol user_id → nome):**

| user_id | Nome |
|---------|------|
| `7f6249ad-4b2b-4ca1-b298-f078dfc8d03b` | Hamon Vitorino |
| `6e7e3f9a-3456-4296-8c5b-f3b8ef14d103` | David Macedo |
| `ef712a54-8b7b-492f-936b-c38dabc01f8e` | Thiago Brito |
| `8d271d3a-139e-4273-baec-729bfb2dfd1b` | Michel Egidio |
| `0d5d7248-ef8c-460e-a5d3-49997ed3d2fe` | Roberto Sales |
| `08648e5c-81f7-4fcb-a581-ba1c8a2596e0` | Fábio Oliveira |
| `9d4a0595-3e1d-40fc-9715-370c3e072b57` | Henrique Saraiva |
| `a7501df4-0689-4ac3-a367-3b23c31ea88f` | JoãoFilho |
| `4ccdf0db-c9e6-43c2-ad83-ca7507fb0b55` | Civilizado |
| `eba7845b-7895-4a46-bf47-6f87b4dcc44c` | Raimundo Nonato |
| `8e709090-f455-4d03-8308-3e74d55624ad` | Hermes Junior |
| `f197cbe1-3de8-410f-b6ef-03170e16667d` | Josué |

Cada palpite contém `points_earned`, `status`, `scoring_state`, `created_at` e `updated_at`. Para a pontuação do dia, **filtrar por `updated_at`** (data em que o palpite foi pontuado) e **não por `created_at`** (data em que o palpite foi enviado). Somar `points_earned` dos que já foram processados (`status: "processed"`, `scoring_state: "scored"`, `points_earned > 0`).

### Passo 3: Apresentar o Ranking

Combinar os dados e apresentar no formato:

```
🏆 RANKING CARTOLA ABJ — 30/06/2026

| # | Participante | Total | Hoje | Ontem | Tiebreaker (E/D/W) |
|---|-------------|-------|------|-------|---------------------|
| 1 | Fábio Oliveira | 298.0 | +16.0 | +34.0 | 10/22/47 |
```

Calcular:
- **Total**: (`total_points` do leaderboard + `points_earned` de hoje) / 100
- **Hoje**: soma de `points_earned` dos palpites de hoje / 100
- **Ontem**: soma de `points_earned` dos palpites de ontem / 100
- **Tiebreaker**: `exact_score_count / goal_diff_count / winner_count`

## Script de Exemplo

Script python que automatiza os 3 passos:

```python
import json, urllib.request

JWT = "<token>"
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

# Passo 1: Leaderboard
lb = api(f"https://bolaodefutebol.com/groups/{GROUP}/leaderboard?limit=1000&tiebreaker=true")

# Passo 2: Daily points (hoje = 2026-06-30, ontem = 2026-06-29)
today = "2026-06-30"
yesterday = "2026-06-29"
for entry in lb["entries"]:
    uid = entry["user_id"]
    preds = api(f"https://bolaodefutebol.com/users/{uid}/predictions?groupId={GROUP}")
    today_pts = sum(p["points_earned"] for p in preds
                    if p.get("updated_at","").startswith(today)
                    and p["status"] == "processed"
                    and p.get("scoring_state") == "scored"
                    and p["points_earned"] > 0)
    yesterday_pts = sum(p["points_earned"] for p in preds
                        if p.get("updated_at","").startswith(yesterday)
                        and p["status"] == "processed"
                        and p.get("scoring_state") == "scored"
                        and p["points_earned"] > 0)
    entry["today_points"] = today_pts
    entry["yesterday_points"] = yesterday_pts

# Passo 3: Display (Total = leaderboard + hoje, dividido por 100)
for e in lb["entries"]:
    e["combined_total"] = e["total_points"] + e["today_points"]

lb["entries"].sort(key=lambda e: -e["combined_total"])
print(f"{'#':<3} {'Participante':<18} {'Total':>7} {'Hoje':>7} {'Ontem':>7}  E/D/W")
for i, e in enumerate(lb["entries"]):
    name = USERS.get(e["user_id"], e["user_name"])
    ts = e["tiebreaker_stats"]
    total = e["combined_total"] / 100
    hoje = e["today_points"] / 100 if e["today_points"] else 0
    ontem = e["yesterday_points"] / 100 if e["yesterday_points"] else 0
    hoje_str = f"+{hoje:.1f}" if hoje else "-"
    ontem_str = f"+{ontem:.1f}" if ontem else "-"
    print(f"{i+1:<3} {name:<18} {total:>6.1f}  {hoje_str:>6}  {ontem_str:>6}  {ts['exact_score_count']}/{ts['goal_diff_count']}/{ts['winner_count']}")
```

## Observações

- **Somente leitura**: esta Skill nunca escreve no Supabase ou no bolaodefutebol.
- **Token**: sempre verificar validade do JWT antes de iniciar. Se expirado (`"try refresh token"`), pedir ao usuário.
- **Time zone**: as datas nos palpites (`created_at`) estão em UTC. Para "hoje" no fuso BRT (UTC-3), usar a data UTC correspondente.
