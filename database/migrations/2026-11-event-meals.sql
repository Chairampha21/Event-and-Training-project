-- Which meals an event serves (อาหารเช้า, อาหารว่างช่วงเช้า, อาหารกลางวัน,
-- อาหารว่างช่วงบ่าย, อาหารเย็น, อาหารว่างช่วงค่ำ).
-- Run once on databases created before this change.
ALTER TABLE events ADD COLUMN meals VARCHAR(60) NULL AFTER ask_dietary;
