-- Migration: seed bracket_slots with the 31 knockout slots
-- Based on the FIFA 2026 World Cup 48-team format:
--   12 group winners + 12 runners-up + 8 best 3rd-place teams = 32 teams
--   Round of 32 (16 games) → Round of 16 (8) → Quarterfinals (4) → Semifinals (2) → Final + 3rd Place
--
-- Tree structure (sequential pairing):
--   R32-01 + R32-02 → R16-01    R32-09 + R32-10 → R16-05
--   R32-03 + R32-04 → R16-02    R32-11 + R32-12 → R16-06
--   R32-05 + R32-06 → R16-03    R32-13 + R32-14 → R16-07
--   R32-07 + R32-08 → R16-04    R32-15 + R32-16 → R16-08
--   R16-01 + R16-02 → QF-01     R16-05 + R16-06 → QF-03
--   R16-03 + R16-04 → QF-02     R16-07 + R16-08 → QF-04
--   QF-01 + QF-02  → SF-01      QF-03 + QF-04  → SF-02
--   SF-01 + SF-02  → FINAL (winners), 3RD (losers)
--
-- Source descriptions for R32 are based on the official FIFA bracket;
-- non-R32 slots derive from previous round winners.

INSERT INTO bracket_slots (label, phase, position, source_home, source_away, next_slot_label) VALUES

-- =========== ROUND OF 32 (16 slots) ===========
('R32-01', '16 avos de Final', 1,  '1º Grupo A',             'Melhor 3º C/D/E/F',    'R16-01'),
('R32-02', '16 avos de Final', 2,  '2º Grupo A',             '2º Grupo B',           'R16-01'),
('R32-03', '16 avos de Final', 3,  '1º Grupo B',             'Melhor 3º A/C/D/F',    'R16-02'),
('R32-04', '16 avos de Final', 4,  '2º Grupo C',             '2º Grupo D',           'R16-02'),
('R32-05', '16 avos de Final', 5,  '1º Grupo C',             'Melhor 3º A/B/D/F',    'R16-03'),
('R32-06', '16 avos de Final', 6,  '2º Grupo E',             '2º Grupo F',           'R16-03'),
('R32-07', '16 avos de Final', 7,  '1º Grupo D',             'Melhor 3º B/E/F/G',    'R16-04'),
('R32-08', '16 avos de Final', 8,  '2º Grupo G',             '2º Grupo H',           'R16-04'),
('R32-09', '16 avos de Final', 9,  '1º Grupo E',             'Melhor 3º A/B/C/D/F',  'R16-05'),
('R32-10', '16 avos de Final', 10, '2º Grupo I',             '2º Grupo J',           'R16-05'),
('R32-11', '16 avos de Final', 11, '1º Grupo F',             'Melhor 3º C/E/H/I',    'R16-06'),
('R32-12', '16 avos de Final', 12, '2º Grupo K',             '2º Grupo L',           'R16-06'),
('R32-13', '16 avos de Final', 13, '1º Grupo G',             'Melhor 3º D/E/I/J',    'R16-07'),
('R32-14', '16 avos de Final', 14, '2º Grupo A',             '2º Grupo C',           'R16-07'),
('R32-15', '16 avos de Final', 15, '1º Grupo H',             'Melhor 3º F/G/J/K',    'R16-08'),
('R32-16', '16 avos de Final', 16, '2º Grupo B',             '2º Grupo D',           'R16-08'),

-- =========== ROUND OF 16 (8 slots) ===========
('R16-01', 'Oitavas de Final', 1, 'Venc. R32-01', 'Venc. R32-02', 'QF-01'),
('R16-02', 'Oitavas de Final', 2, 'Venc. R32-03', 'Venc. R32-04', 'QF-01'),
('R16-03', 'Oitavas de Final', 3, 'Venc. R32-05', 'Venc. R32-06', 'QF-02'),
('R16-04', 'Oitavas de Final', 4, 'Venc. R32-07', 'Venc. R32-08', 'QF-02'),
('R16-05', 'Oitavas de Final', 5, 'Venc. R32-09', 'Venc. R32-10', 'QF-03'),
('R16-06', 'Oitavas de Final', 6, 'Venc. R32-11', 'Venc. R32-12', 'QF-03'),
('R16-07', 'Oitavas de Final', 7, 'Venc. R32-13', 'Venc. R32-14', 'QF-04'),
('R16-08', 'Oitavas de Final', 8, 'Venc. R32-15', 'Venc. R32-16', 'QF-04'),

-- =========== QUARTERFINALS (4 slots) ===========
('QF-01', 'Quartas de Final', 1, 'Venc. R16-01', 'Venc. R16-02', 'SF-01'),
('QF-02', 'Quartas de Final', 2, 'Venc. R16-03', 'Venc. R16-04', 'SF-01'),
('QF-03', 'Quartas de Final', 3, 'Venc. R16-05', 'Venc. R16-06', 'SF-02'),
('QF-04', 'Quartas de Final', 4, 'Venc. R16-07', 'Venc. R16-08', 'SF-02'),

-- =========== SEMIFINALS (2 slots) ===========
('SF-01', 'Semifinal', 1, 'Venc. QF-01', 'Venc. QF-02', 'FINAL'),
('SF-02', 'Semifinal', 2, 'Venc. QF-03', 'Venc. QF-04', 'FINAL'),

-- =========== THIRD PLACE (losers of SF) ===========
('3RD', 'Terceiro Lugar', 1, 'Perd. SF-01', 'Perd. SF-02', NULL),

-- =========== FINAL (winners of SF) ===========
('FINAL', 'Final', 1, 'Venc. SF-01', 'Venc. SF-02', NULL);
