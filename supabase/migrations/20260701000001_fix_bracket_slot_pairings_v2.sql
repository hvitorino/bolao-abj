-- Migration: Fix bracket slot pairings to match the official FIFA 2026 bracket
-- v2: reverts the incorrect v1 migration and fixes QF→SF and SF source mappings.
--
-- Correct structure:
--   Lado Esquerdo (→ SF-01):  QF-01 (R32 01-04) + QF-03 (R32 09-12)
--   Lado Direito  (→ SF-02):  QF-02 (R32 05-08) + QF-04 (R32 13-16)
--
-- All UPDATEs are idempotent (WHERE label = '...' is unique).

-- =========== Revert R32 next_slot_label to sequential pairing ===========

UPDATE bracket_slots SET next_slot_label = 'R16-01' WHERE label = 'R32-02';
UPDATE bracket_slots SET next_slot_label = 'R16-02' WHERE label = 'R32-03';
UPDATE bracket_slots SET next_slot_label = 'R16-02' WHERE label = 'R32-04';
UPDATE bracket_slots SET next_slot_label = 'R16-03' WHERE label = 'R32-05';
UPDATE bracket_slots SET next_slot_label = 'R16-05' WHERE label = 'R32-09';
UPDATE bracket_slots SET next_slot_label = 'R16-05' WHERE label = 'R32-10';
UPDATE bracket_slots SET next_slot_label = 'R16-06' WHERE label = 'R32-11';
UPDATE bracket_slots SET next_slot_label = 'R16-06' WHERE label = 'R32-12';
UPDATE bracket_slots SET next_slot_label = 'R16-07' WHERE label = 'R32-13';
UPDATE bracket_slots SET next_slot_label = 'R16-08' WHERE label = 'R32-16';

-- =========== Revert R16 source_home/source_away to sequential ===========

UPDATE bracket_slots SET source_home = 'Venc. R32-01', source_away = 'Venc. R32-02' WHERE label = 'R16-01';
UPDATE bracket_slots SET source_home = 'Venc. R32-03', source_away = 'Venc. R32-04' WHERE label = 'R16-02';
UPDATE bracket_slots SET source_home = 'Venc. R32-05', source_away = 'Venc. R32-06' WHERE label = 'R16-03';
UPDATE bracket_slots SET source_home = 'Venc. R32-09', source_away = 'Venc. R32-10' WHERE label = 'R16-05';
UPDATE bracket_slots SET source_home = 'Venc. R32-11', source_away = 'Venc. R32-12' WHERE label = 'R16-06';
UPDATE bracket_slots SET source_home = 'Venc. R32-13', source_away = 'Venc. R32-14' WHERE label = 'R16-07';
UPDATE bracket_slots SET source_home = 'Venc. R32-15', source_away = 'Venc. R32-16' WHERE label = 'R16-08';

-- =========== Fix QF → SF pairings ===========
-- QF-01 + QF-03 → SF-01 (Lado Esquerdo)
-- QF-02 + QF-04 → SF-02 (Lado Direito)

UPDATE bracket_slots SET next_slot_label = 'SF-02' WHERE label = 'QF-02';
UPDATE bracket_slots SET next_slot_label = 'SF-01' WHERE label = 'QF-03';

-- =========== Fix SF source descriptions ===========

UPDATE bracket_slots
  SET source_home = 'Venc. QF-01', source_away = 'Venc. QF-03'
  WHERE label = 'SF-01';

UPDATE bracket_slots
  SET source_home = 'Venc. QF-02', source_away = 'Venc. QF-04'
  WHERE label = 'SF-02';
