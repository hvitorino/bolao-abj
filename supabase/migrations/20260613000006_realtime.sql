-- Migration 006: habilitar Supabase Realtime em games e scores
ALTER TABLE games  REPLICA IDENTITY FULL;
ALTER TABLE scores REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
