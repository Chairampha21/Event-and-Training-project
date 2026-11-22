-- Which programme an event is for: 'cs' (วิทยาการคอมพิวเตอร์), 'it'
-- (เทคโนโลยีสารสนเทศ) or 'all'. Only students of that programme may register
-- for a 'cs' / 'it' event.
-- Run once on databases created before this change.
ALTER TABLE events ADD COLUMN program ENUM('all','cs','it') NOT NULL DEFAULT 'all' AFTER subcategory;
