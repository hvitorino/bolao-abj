-- Adiciona coluna group_letter (A-L) para identificar o grupo de cada jogo
-- Usado pela funcionalidade group-standings-bottom-sheet para filtrar jogos do mesmo grupo
-- Fonte: ESPN API altGameNote (mesmo mapping de 20260624000003_fix_rounds_static.sql)

ALTER TABLE games ADD COLUMN group_letter text;

UPDATE games SET group_letter = 'A' WHERE espn_id IN ('760414','760415','760438','760441','760466','760467');
UPDATE games SET group_letter = 'B' WHERE espn_id IN ('760416','760420','760439','760440','760462','760463');
UPDATE games SET group_letter = 'C' WHERE espn_id IN ('760418','760419','760444','760445','760464','760465');
UPDATE games SET group_letter = 'D' WHERE espn_id IN ('760417','760421','760442','760443','760469','760470');
UPDATE games SET group_letter = 'E' WHERE espn_id IN ('760422','760423','760446','760448','760468','760473');
UPDATE games SET group_letter = 'F' WHERE espn_id IN ('760424','760425','760447','760449','760471','760472');
UPDATE games SET group_letter = 'G' WHERE espn_id IN ('760426','760427','760451','760452','760476','760477');
UPDATE games SET group_letter = 'H' WHERE espn_id IN ('760428','760429','760450','760453','760478','760479');
UPDATE games SET group_letter = 'I' WHERE espn_id IN ('760430','760432','760454','760457','760474','760475');
UPDATE games SET group_letter = 'J' WHERE espn_id IN ('760431','760433','760455','760456','760483','760484');
UPDATE games SET group_letter = 'K' WHERE espn_id IN ('760435','760436','760459','760461','760481','760482');
UPDATE games SET group_letter = 'L' WHERE espn_id IN ('760434','760437','760458','760460','760480','760485');
