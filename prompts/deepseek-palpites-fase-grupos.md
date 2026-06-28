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
- For balanced matchups, lean toward draws (1-1 or 0-0) rather than speculating on a winner.
- Avoid speculative landslides (4-0, 5-0) unless the mismatch is extreme — exact score probability is higher at 3-0 or 2-0.

## Your task
Generate predictions for all 72 FIFA World Cup 2026 group stage games for each of the 2 DeepSeek models below. Each model acts as an independent AI agent with the same score-maximizing strategy. Introduce small natural variation between models on borderline/uncertain matchups (draws vs narrow wins, goal count uncertainty).

## Output format
Return ONLY a CSV with this exact header and no extra text:

user_id,game_id,group_id,home_score,away_score

## Models (use these exact user_ids)
| Model | user_id |
|-------|---------|
| DSInstant (DeepSeek v4 Flash) | 520abbd0-3fda-40c0-bd29-5394ec5e2de8 |
| DSExpert (DeepSeek v4 Pro) | 9f0dfabf-347f-4264-8ba1-e99874c04e97 |

**group_id for all rows: 6f75de14-0a1e-4d4d-8184-e7bdbac6e276**

## Games (72 total — FIFA World Cup 2026 Group Stage)
Use these exact game_ids. Predictions are based on pre-tournament team quality and FIFA rankings — do NOT use knowledge of actual 2026 results.

| game_id | Home | Away | Round |
|---------|------|------|-------|
| 14b27843-f2d5-4042-b04f-5378c55f0c4b | México | África do Sul | R1 |
| 0de17e12-93b3-405e-984e-d01b011696d3 | Coreia do Sul | República Tcheca | R1 |
| 125685ca-adf1-4ac4-82b5-829f45161aba | Canadá | Bósnia e Herzegovina | R1 |
| 24c2f3a1-f8fc-4c2b-a024-050131c43c90 | Estados Unidos | Paraguai | R1 |
| c69f05e3-00c5-4640-beb5-bce1a247df23 | Catar | Suíça | R1 |
| d45e25c7-adfe-45ff-b34c-5fbe3347da37 | Brasil | Marrocos | R1 |
| c9a6827d-d666-4917-abc9-7f3e7824a49f | Haiti | Escócia | R1 |
| d4bb9faf-35af-4442-bb9d-9a6681037048 | Austrália | Türkiye | R1 |
| 4b839dfd-0cb3-4ea2-93cb-2491925ef7f0 | Alemanha | Curaçao | R1 |
| bcb27d08-014b-47fe-8171-d40f95e449d7 | Países Baixos | Japão | R1 |
| e5088c40-90a0-466d-b922-cd1ef64a0fe6 | Costa do Marfim | Equador | R1 |
| 96a9f340-44a1-4463-bf70-afc1d7e05a79 | Suécia | Tunísia | R1 |
| 050adada-4e49-4828-9c81-a4bc3679fe11 | Espanha | Cape Verde | R1 |
| 65913a94-0ed0-4ff2-8758-24302fab6f0b | Bélgica | Egito | R1 |
| 53ad5c10-5f0b-4c42-aa06-e0e100df791a | Arábia Saudita | Uruguai | R1 |
| 94897c08-5181-4a34-956f-c149eeccf488 | Irã | Nova Zelândia | R1 |
| 83351289-5104-4884-8d6e-6e85dc0371ed | França | Senegal | R1 |
| 929ff580-7db8-4ccd-955f-c44ef91f3f96 | Iraque | Noruega | R1 |
| 835df7ab-a2e5-41ed-a5fd-4dba1f053bb4 | Argentina | Argélia | R1 |
| b115f2d0-4977-4081-9bb0-21319e7b5ef0 | Áustria | Jordan | R1 |
| aa1d6e7d-649f-4e0b-ba37-2d47896ae80f | Portugal | Congo DR | R1 |
| 76610c2c-860d-449c-bc2d-c172d7a5baee | Inglaterra | Croácia | R1 |
| b7250f6b-9870-4406-91b3-fec17030a2c3 | Gana | Panama | R1 |
| 8d02995e-2285-4ae9-b93e-1be0e5fd1315 | Uzbekistan | Colômbia | R1 |
| 744fc8d1-cc0c-4850-a60f-a2c88644e83f | República Tcheca | África do Sul | R2 |
| 015b6c60-cf81-4cf1-bfc5-76091c9d9b12 | Suíça | Bósnia e Herzegovina | R2 |
| e1912c80-882a-48b7-b4a0-54fcec39866c | Canadá | Catar | R2 |
| 0b3d279f-6887-4c8b-a65c-30cb865ac634 | México | Coreia do Sul | R2 |
| 9e5fde5f-2e66-40a5-a388-0bbee4d52024 | Estados Unidos | Austrália | R2 |
| 0147b610-c7bc-47ff-b4e7-8903280e8aff | Escócia | Marrocos | R2 |
| 7b813459-8cfe-4c87-a763-33475c5a6219 | Brasil | Haiti | R2 |
| 17dfe6f4-d22f-4b73-8f79-f9b729c6019f | Türkiye | Paraguai | R2 |
| 6f60d6e1-a828-4dbb-8b38-930afbae4920 | Países Baixos | Suécia | R2 |
| 1f7067bd-be90-4b1f-88b2-366a8125e50f | Alemanha | Costa do Marfim | R2 |
| b19b498f-bf0c-4c0a-a231-bf47e253de16 | Equador | Curaçao | R2 |
| 87e32c7e-fbc9-43a6-aa51-29b702d1eb49 | Tunísia | Japão | R2 |
| 6d8b4bda-ca2c-470b-9719-ecace6491b0c | Espanha | Arábia Saudita | R2 |
| cd4175d5-5c25-4092-8f2b-8ccb920410af | Bélgica | Irã | R2 |
| 0df7b397-25ca-4c51-87fc-9cbcbf4bef11 | Uruguai | Cape Verde | R2 |
| 64f2ac45-17b9-4249-a0fa-55bea09c0086 | Nova Zelândia | Egito | R2 |
| 18f2dc51-323f-49f5-a0da-b91ceeacaf2c | Argentina | Áustria | R2 |
| 72c627bb-e80f-4654-9fe5-c46735cfaa20 | França | Iraque | R2 |
| 71344b97-7dc9-4406-811c-3e5c5329ab3e | Noruega | Senegal | R2 |
| 08964492-9cf2-4f3c-86bc-0e42a028dd40 | Jordan | Argélia | R2 |
| 039f555d-dd0f-4786-a817-2ffb412a3e3c | Portugal | Uzbekistan | R2 |
| 5f571ca9-cb4a-4253-9413-8d111c0de299 | Inglaterra | Gana | R2 |
| efc2ebb2-07dd-49b1-87a6-8002f1939267 | Panama | Croácia | R2 |
| d8d9827a-5b69-46ce-83cc-da0350fbc07d | Colômbia | Congo DR | R2 |
| 0f9464bd-8758-4899-b073-b63574b09b9e | Bósnia e Herzegovina | Catar | R3 |
| b4ae5b17-7b23-471d-a623-ed8ab9ce772a | Suíça | Canadá | R3 |
| d43c1ce8-1e12-4d34-803b-72117373d0e8 | Marrocos | Haiti | R3 |
| ba618bd9-887d-4953-8334-d7e264391642 | Escócia | Brasil | R3 |
| 739a5cf4-b9c7-4fc6-a625-bf5afcc1ad10 | África do Sul | Coreia do Sul | R3 |
| 377907b5-7bfb-4d8a-ba0c-e068714e6b5e | República Tcheca | México | R3 |
| d032fba2-2473-4aeb-919e-6d73c3ae6c14 | Curaçao | Costa do Marfim | R3 |
| 3602066e-ef0a-4362-9aed-1b4d56cbc922 | Equador | Alemanha | R3 |
| 7f8d3b66-9e5f-4c5c-9ef5-e521babe8c4f | Japão | Suécia | R3 |
| 7a558fdd-7070-4f29-8426-70f3888f3094 | Tunísia | Países Baixos | R3 |
| 3e093bae-9789-4921-b69c-85574303a0a1 | Paraguai | Austrália | R3 |
| 1149b5aa-63f5-4bc2-ab82-db0d696363f6 | Türkiye | Estados Unidos | R3 |
| 3fd43ebd-d0e5-49c2-bb49-34cd6a969409 | Senegal | Iraq | R3 |
| 5ed38121-9449-4848-8e1e-0f51a1bcc121 | Noruega | França | R3 |
| 85cca723-8cdc-4d7a-b8a8-333a06ff763d | Cape Verde | Arábia Saudita | R3 |
| eff0134b-f286-456a-8306-83ec1349025a | Uruguai | Espanha | R3 |
| 0a58b6ab-4aca-4a2a-81f9-a23eb7046cce | Nova Zelândia | Bélgica | R3 |
| a9e603f0-2b52-4b25-a6c2-5d0b30479770 | Egito | Irã | R3 |
| bcb62e69-3c88-4250-b116-c2f1a769eb23 | Croácia | Gana | R3 |
| 3f64e820-6e1d-480a-b83f-3078974c3f3d | Panama | Inglaterra | R3 |
| dc85e75d-1565-41a9-b826-a6d51116027f | Colômbia | Portugal | R3 |
| 5e041fb8-d92a-4462-b816-5a1dd8e60e4a | Congo DR | Uzbekistan | R3 |
| 9d641749-a381-473d-91c2-473d39af02ee | Jordan | Argentina | R3 |
| ebbb85ed-c23b-4c62-8456-5c8bfbae0770 | Argélia | Austria | R3 |

The CSV must have exactly 144 data rows (72 games × 2 models). Output only the CSV, no markdown fences, no explanation.
