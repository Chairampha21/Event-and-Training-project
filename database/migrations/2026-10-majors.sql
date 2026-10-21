-- Students' majors use the department's two programme names.
-- Run once on databases created before this change.
UPDATE users SET dept = REPLACE(dept, 'วท.บ. คอมพิวเตอร์', 'วิทยาการคอมพิวเตอร์') WHERE dept LIKE '%วท.บ. คอมพิวเตอร์%';
UPDATE users SET dept = REPLACE(dept, 'วท.บ. เทคโนโลยีสารสนเทศ', 'เทคโนโลยีสารสนเทศ') WHERE dept LIKE '%วท.บ. เทคโนโลยีสารสนเทศ%';
