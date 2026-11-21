-- Gender on the profile; evaluation forms pre-select it.
-- Run once, after 2026-11-personal-info.sql.
ALTER TABLE users ADD COLUMN gender ENUM('male','female','unspecified') NULL AFTER nickname;
