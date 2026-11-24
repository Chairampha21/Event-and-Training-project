-- =====================================================================
-- Demo: fiscal year 2570 keeps only events that belong to the department's
-- student development budget plan (แผนพัฒนานักศึกษา ภาควิชาคอมพิวเตอร์).
--
-- Removed (demo_organizer events that fit no item of the plan):
--   1001 สัมมนา AI ในอุตสาหกรรมซอฟต์แวร์ 2027, 1003 อบรม Git & GitHub สำหรับทำงานเป็นทีม,
--   1007 อบรม Docker และ Container เบื้องต้น, 1009 Hackathon 3 วัน: Smart Campus,
--   1010 อบรม SQL สำหรับการวิเคราะห์ข้อมูล
--   — with their registrations, check-ins and the notifications that point
--   to them.
--
-- Kept, now tied to their plan item (budget and who is responsible), on
-- fixed dates so posters made for them stay right whatever day the data is
-- loaded (demo_organizer's dates count from the load day):
--   1005 ค่ายติวเข้ม Python สำหรับการแข่งขันเขียนโปรแกรม  item 4.1 (ICPC)  30,000  อ.ดร.ภูริวัจน์   Mon 7 Dec 2569
--   1012 CPSU Code Challenge 2026                    item 4          25,000  ผศ.โอภาส        Tue 15 – Wed 16 Dec 2569
--   1008 Webinar: เตรียมตัวฝึกงานสายไอที              item 10         20,000  ผศ.ดร.สัจจาภรณ์  Wed 25 Nov 2569
--
-- Apply AFTER demo_organizer, seed_fy2569_moves, seed_blacklist and
-- seed_english_camp. Safe to run again.
--   docker exec -i cpsu-etms-mysql mysql --default-character-set=utf8mb4 -uroot cpsu_etms < database/seed_fy2570_plan.sql
-- =====================================================================

USE cpsu_etms;
SET NAMES utf8mb4;

-- ------------------------------------------------------------------ not in the plan: removed
DELETE FROM notifications WHERE link REGEXP '[?&](applicants|event)=(1001|1003|1007|1009|1010)$';
DELETE FROM events WHERE id IN (1001, 1003, 1007, 1009, 1010);   -- registrations, check-ins, questions cascade

-- ------------------------------------------------------------------ kept: fixed dates
DROP TEMPORARY TABLE IF EXISTS tmp_move;
CREATE TEMPORARY TABLE tmp_move (event_id INT UNSIGNED PRIMARY KEY, target DATE, days INT);
INSERT INTO tmp_move (event_id, target) VALUES (1005, '2026-12-07'), (1012, '2026-12-15'), (1008, '2026-11-25');
UPDATE tmp_move m JOIN events e ON e.id = m.event_id SET m.days = DATEDIFF(m.target, e.date_start);

UPDATE events e JOIN tmp_move m ON m.event_id = e.id
SET e.date_start = e.date_start + INTERVAL m.days DAY,
    e.date_end   = e.date_end   + INTERVAL m.days DAY,
    e.reg_start  = e.reg_start  + INTERVAL m.days DAY,
    e.reg_end    = e.reg_end    + INTERVAL m.days DAY,
    e.created_at = e.created_at + INTERVAL m.days DAY;
UPDATE events SET event_dates = '2026-12-15,2026-12-16' WHERE id = 1012;

UPDATE registrations r JOIN tmp_move m ON m.event_id = r.event_id
SET r.registered_at       = r.registered_at       + INTERVAL m.days DAY,
    r.checked_in_at       = r.checked_in_at       + INTERVAL m.days DAY,
    r.paid_at             = r.paid_at             + INTERVAL m.days DAY,
    r.slip_transferred_at = r.slip_transferred_at + INTERVAL m.days DAY,
    r.slip_submitted_at   = r.slip_submitted_at   + INTERVAL m.days DAY;
UPDATE registration_checkins c JOIN registrations r ON r.id = c.registration_id JOIN tmp_move m ON m.event_id = r.event_id
SET c.event_date = c.event_date + INTERVAL m.days DAY, c.checked_in_at = c.checked_in_at + INTERVAL m.days DAY;
DROP TEMPORARY TABLE tmp_move;

-- ------------------------------------------------------------------ kept: their plan item
UPDATE events SET organizer_name = 'อ.ดร.ภูริวัจน์ วรวิชัยพัฒน์', coordinator_id = 1033,
  budget_planned = 30000, budget_other = NULL,
  description = CONCAT(description, '\n\nภายใต้โครงการสนับสนุนนักศึกษาเข้าร่วมการแข่งขันเขียนโปรแกรมระดับมหาวิทยาลัย ICPC Thailand National Contest (แผนพัฒนานักศึกษา ภาควิชาคอมพิวเตอร์ ข้อ 4.1)')
WHERE id = 1005 AND description NOT LIKE '%ข้อ 4.1)%';

UPDATE events SET organizer_name = 'ผศ.โอภาส วงษ์ทวีทรัพย์', coordinator_id = 1032,
  budget_planned = 25000, budget_other = NULL,
  description = CONCAT(description, '\n\nภายใต้โครงการการสนับสนุนศักยภาพนักศึกษาเพื่อก้าวสู่ความเป็นเลิศทางด้านวิชาการระดับชาติและนานาชาติ (Student Academic Empowerment, แผนพัฒนานักศึกษา ภาควิชาคอมพิวเตอร์ ข้อ 4)')
WHERE id = 1012 AND description NOT LIKE '%ข้อ 4)%';

UPDATE events SET organizer_name = 'ผศ.ดร.สัจจาภรณ์ ไวจรรยา', coordinator_id = 1043,
  budget_planned = 20000, budget_other = NULL,
  description = CONCAT(description, '\n\nภายใต้โครงการก้าวสู่สหกิจอย่างมืออาชีพ (Step to Professional Co-op Program, แผนพัฒนานักศึกษา ภาควิชาคอมพิวเตอร์ ข้อ 10)')
WHERE id = 1008 AND description NOT LIKE '%ข้อ 10)%';
