-- Titles and English names for users (run once on an existing database).
ALTER TABLE users ADD COLUMN title_th VARCHAR(40) NULL AFTER name,
  ADD COLUMN name_en VARCHAR(150) NULL AFTER title_th,
  ADD COLUMN title_en VARCHAR(40) NULL AFTER name_en;

-- Titles typed at the start of a name move into title_th (longest first, so
-- "ผศ.ดร." wins over "ผศ."); the English title follows from the Thai one.
SET @t := NULL;
UPDATE users u JOIN (
  SELECT 'ผู้ช่วยศาสตราจารย์ ดร.' AS th, 'Asst. Prof. Dr.' AS en, 1 AS o UNION ALL
  SELECT 'รองศาสตราจารย์ ดร.', 'Assoc. Prof. Dr.', 2 UNION ALL
  SELECT 'ศาสตราจารย์ ดร.', 'Prof. Dr.', 3 UNION ALL
  SELECT 'ผู้ช่วยศาสตราจารย์', 'Asst. Prof.', 4 UNION ALL
  SELECT 'รองศาสตราจารย์', 'Assoc. Prof.', 5 UNION ALL
  SELECT 'ศาสตราจารย์', 'Prof.', 6 UNION ALL
  SELECT 'ผศ.ดร.', 'Asst. Prof. Dr.', 7 UNION ALL
  SELECT 'รศ.ดร.', 'Assoc. Prof. Dr.', 8 UNION ALL
  SELECT 'ศ.ดร.', 'Prof. Dr.', 9 UNION ALL
  SELECT 'อ.ดร.', 'Dr.', 10 UNION ALL
  SELECT 'ผศ.', 'Asst. Prof.', 11 UNION ALL
  SELECT 'รศ.', 'Assoc. Prof.', 12 UNION ALL
  SELECT 'ศ.', 'Prof.', 13 UNION ALL
  SELECT 'ดร.', 'Dr.', 14 UNION ALL
  SELECT 'อ.', 'Ajarn', 15 UNION ALL
  SELECT 'นางสาว', 'Miss', 16 UNION ALL
  SELECT 'เด็กชาย', 'Master', 17 UNION ALL
  SELECT 'เด็กหญิง', 'Miss', 18 UNION ALL
  SELECT 'นาย', 'Mr.', 19 UNION ALL
  SELECT 'นาง', 'Mrs.', 20
) t ON u.title_th IS NULL AND u.name LIKE CONCAT(t.th, '%')
   AND t.o = (SELECT MIN(t2.o) FROM (
     SELECT 'ผู้ช่วยศาสตราจารย์ ดร.' AS th, 1 AS o UNION ALL SELECT 'รองศาสตราจารย์ ดร.', 2 UNION ALL SELECT 'ศาสตราจารย์ ดร.', 3 UNION ALL
     SELECT 'ผู้ช่วยศาสตราจารย์', 4 UNION ALL SELECT 'รองศาสตราจารย์', 5 UNION ALL SELECT 'ศาสตราจารย์', 6 UNION ALL
     SELECT 'ผศ.ดร.', 7 UNION ALL SELECT 'รศ.ดร.', 8 UNION ALL SELECT 'ศ.ดร.', 9 UNION ALL SELECT 'อ.ดร.', 10 UNION ALL
     SELECT 'ผศ.', 11 UNION ALL SELECT 'รศ.', 12 UNION ALL SELECT 'ศ.', 13 UNION ALL SELECT 'ดร.', 14 UNION ALL SELECT 'อ.', 15 UNION ALL
     SELECT 'นางสาว', 16 UNION ALL SELECT 'เด็กชาย', 17 UNION ALL SELECT 'เด็กหญิง', 18 UNION ALL SELECT 'นาย', 19 UNION ALL SELECT 'นาง', 20
   ) t2 WHERE u.name LIKE CONCAT(t2.th, '%'))
SET u.title_th = t.th, u.title_en = t.en, u.name = TRIM(SUBSTRING(u.name, CHAR_LENGTH(t.th) + 1));

-- A name with no Thai letters (e.g. taken from a Google account) is an
-- English name: keep it there too. Its owner is asked for the Thai one.
UPDATE users SET name_en = name WHERE name_en IS NULL AND name NOT REGEXP '[ก-๙]';
