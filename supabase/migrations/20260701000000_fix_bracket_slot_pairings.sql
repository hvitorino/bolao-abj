-- Migration: Fix bracket slot pairings to match official FIFA 2026 bracket
-- The seed used sequential pairing (R32-01+02→R16-01, R32-03+04→R16-02…)
-- but the official FIFA 2026 bracket uses non-sequential pairings.
--
-- Correct structure after fix:
--   Chave esquerda (→ SF-01): R32-01,03 → R16-01; R32-02,05 → R16-02; R32-04,06 → R16-03; R32-07,08 → R16-04
--   Chave direita  (→ SF-02): R32-11,12 → R16-05; R32-09,10 → R16-06; R32-14,16 → R16-07; R32-13,15 → R16-08
--
-- All UPDATEs are idempotent (WHERE label = '...' is unique).

-- =========== Fix next_slot_label for R32 slots ===========

UPDATE bracket_slots SET next_slot_label = 'R16-02' WHERE label = 'R32-02';
UPDATE bracket_slots SET next_slot_label = 'R16-01' WHERE label = 'R32-03';
UPDATE bracket_slots SET next_slot_label = 'R16-03' WHERE label = 'R32-04';
UPDATE bracket_slots SET next_slot_label = 'R16-02' WHERE label = 'R32-05';
UPDATE bracket_slots SET next_slot_label = 'R16-06' WHERE label = 'R32-09';
UPDATE bracket_slots SET next_slot_label = 'R16-06' WHERE label = 'R32-10';
UPDATE bracket_slots SET next_slot_label = 'R16-05' WHERE label = 'R32-11';
UPDATE bracket_slots SET next_slot_label = 'R16-05' WHERE label = 'R32-12';
UPDATE bracket_slots SET next_slot_label = 'R16-08' WHERE label = 'R32-13';
UPDATE bracket_slots SET next_slot_label = 'R16-07' WHERE label = 'R32-16';

-- =========== Fix source_home / source_away for R16 slots ===========

UPDATE bracket_slots
  SET source_home = 'Venc. R32-01', source_away = 'Venc. R32-03'
  WHERE label = 'R16-01';

UPDATE bracket_slots
  SET source_home = 'Venc. R32-02', source_away = 'Venc. R32-05'
  WHERE label = 'R16-02';

UPDATE bracket_slots
  SET source_home = 'Venc. R32-04', source_away = 'Venc. R32-06'
  WHERE label = 'R16-03';

UPDATE bracket_slots
  SET source_home = 'Venc. R32-11', source_away = 'Venc. R32-12'
  WHERE label = 'R16-05';

UPDATE bracket_slots
  SET source_home = 'Venc. R32-09', source_away = 'Venc. R32-10'
  WHERE label = 'R16-06';

UPDATE bracket_slots
  SET source_home = 'Venc. R32-14', source_away = 'Venc. R32-16'
  WHERE label = 'R16-07';

UPDATE bracket_slots
  SET source_home = 'Venc. R32-13', source_away = 'Venc. R32-15'
  WHERE label = 'R16-08';
