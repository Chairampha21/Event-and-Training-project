-- Lets students on the blacklist register for one event anyway — for events
-- every student has to attend (orientation, required briefings).
-- Run once on databases created before this change.
ALTER TABLE events ADD COLUMN allow_blacklisted TINYINT(1) NOT NULL DEFAULT 0 AFTER years;
