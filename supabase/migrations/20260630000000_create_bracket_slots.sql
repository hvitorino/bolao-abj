-- Migration: create bracket_slots table
-- Represents the fixed knockout bracket structure for the 2026 World Cup.
-- 31 slots total: 16 R32 + 8 R16 + 4 QF + 2 SF + 1 3RD + 1 FINAL

CREATE TABLE IF NOT EXISTS bracket_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label           text NOT NULL UNIQUE,       -- "R32-01" ... "R32-16", "R16-01" ... "QF-01" ... "FINAL"
  phase           text NOT NULL,              -- "16 avos de Final" | "Oitavas de Final" | ...
  position        int NOT NULL,               -- ordering within the phase (1-based)
  source_home     text,                       -- "1º Grupo A" or "Venc. R32-01"
  source_away     text,                       -- "Melhor 3º C/D/E/F" or "Venc. R32-02"
  next_slot_label text,                       -- "R16-01" (NULL for FINAL and 3RD)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bracket_slots_next ON bracket_slots(next_slot_label);
