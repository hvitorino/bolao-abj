-- Corrige match_day para usar Pacific Time (UTC-7, PDT), o fuso mais a oeste
-- dos locais da Copa 2026. ESPN usa EDT (UTC-4) para seu scoreboard, o que
-- classifica jogos de meia-noite EDT (ex: TUN×JPN 04:00Z) no dia errado.
-- Com UTC-7, qualquer jogo escalado até 23h local fica no dia correto.
UPDATE games
SET match_day = (match_date - INTERVAL '7 hours')::date;
