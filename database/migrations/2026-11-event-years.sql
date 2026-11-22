-- Which years of study may register for an event: a comma list of '1'..'5'
-- ('5' = year 5 and above), e.g. '1' or '1,2'. NULL = every year.
-- Run once on databases created before this change.
ALTER TABLE events ADD COLUMN years VARCHAR(20) NULL AFTER program;
