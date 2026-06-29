You are predicting scores for a Brazilian football World Cup pool ("bolão") as 2 different DeepSeek AI models.

## Scoring rules (cumulative)
| Event | Points |
|-------|--------|
| Correct winner (or draw) | +3 |
| Exact scoreline | +5 (on top of winner) |
| Correct winner's goal tally only | +3 (on top of winner) |
| Correct goal difference (winner right) | +2 (on top of winner) |
| Correct loser's goal tally only (winner right) | +1 (on top of winner) |
| Landslide: predicted winner scored ≥4 goals AND real goal diff ≥4 | +1 (on top of winner) |

**Strategy: maximize expected points.**
- Prioritize predicting the correct winner — it unlocks all bonuses.
- Prefer the most likely exact score (highest probability scoreline).
- These are knockout games (90-minute score): draws are possible but less likely — teams play to win. Lean toward decisive results unless the matchup is very even.
- Avoid speculative landslides (4-0, 5-0) unless the mismatch is extreme — exact score probability is higher at 3-0 or 2-0.

## Your task
Generate predictions for all 16 FIFA World Cup 2026 round of 16 games for each of the 2 DeepSeek models below. Each model acts as an independent AI agent with the same score-maximizing strategy. Introduce small natural variation between models on borderline/uncertain matchups (draws vs narrow wins, goal count uncertainty).

## Output format
Return ONLY a CSV with this exact header and no extra text:

user_id,game_id,group_id,home_score,away_score

## Models (use these exact user_ids)
| Model | user_id |
|-------|---------|
| DSInstant (DeepSeek v4 Flash) | 520abbd0-3fda-40c0-bd29-5394ec5e2de8 |
| DSExpert (DeepSeek v4 Pro) | 9f0dfabf-347f-4264-8ba1-e99874c04e97 |

**group_id for all rows: 6f75de14-0a1e-4d4d-8184-e7bdbac6e276**

## Games (16 total — FIFA World Cup 2026 Round of 16)
Use these exact game_ids. Predictions are based on pre-tournament team quality and FIFA rankings — do NOT use knowledge of actual 2026 results.

| game_id | Home | Away |
|---------|------|------|
| a1b107e5-9a20-4921-a2a6-65adb6dc01d0 | África do Sul | Canadá |
| e4e70c5b-aaab-4130-9f2c-617e4f32911d | Brasil | Japão |
| 9c78db6b-c340-4ad6-b5ff-11e3d5e9e710 | Alemanha | Paraguai |
| 20c563f2-1a49-4a95-9097-80decf520bed | Países Baixos | Marrocos |
| 70e6035b-f3bf-4bc1-bfb6-e27640f6943d | Costa do Marfim | Noruega |
| 198d518f-92c5-4ff4-add3-145ad3be541c | França | Suécia |
| d9c01e54-fdc2-41cd-9f66-a5ea82631454 | México | Equador |
| 4d124240-7f9e-487b-af2f-c99f8627b030 | Inglaterra | Congo DR |
| bfaa5a94-f701-46af-8215-ea3736382a1a | Bélgica | Senegal |
| ad1f8aaf-459b-442f-a91c-ffbae6c35f21 | Estados Unidos | Bósnia e Herzegovina |
| ccd15915-28e4-47c4-b99b-0da5a83b3bb8 | Espanha | Austria |
| df6c73f9-56ce-4de0-b288-3583e84180ea | Portugal | Croácia |
| 2556b155-677e-4883-9469-1013b8880770 | Suíça | Argélia |
| d01e7d0d-645d-4b0c-92f8-dce103171b14 | Austrália | Egito |
| c4a4b59d-e522-475b-b175-9c44d876496d | Argentina | Cabo Verde |
| 03a96220-49eb-4556-b0f2-272ca4bc48de | Colômbia | Gana |

The CSV must have exactly 32 data rows (16 games × 2 models). Output only the CSV, no markdown fences, no explanation.
