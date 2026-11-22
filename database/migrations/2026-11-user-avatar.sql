-- A profile picture the user may upload: a small square image as a data: URL
-- (the page crops and shrinks it to 256 x 256 before sending).
-- Run once on databases created before this change.
ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT NULL AFTER emergency_contact;
