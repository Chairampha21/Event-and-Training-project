-- =====================================================================
-- Demo blacklist: 5 more suspended students, for trying the Blacklist page.
--   * 3 added by the system — each really missed 3 events in fiscal year
--     2569, so the "ขาด (ครั้ง)" column and the reason agree:
--       ศศิธร แก้วประเสริฐ (1028)   1013 (18 Jul), 1014 (25 Jul), 1015 (5 Aug) → suspended 6 Aug 2026
--       อนุชา วัฒนา (1027)          1013 (already in demo data), 1014, 1015  → suspended 6 Aug 2026
--       มนัสนันท์ ประเสริฐ (1024)   1014, 1015, 1011 (3 Sep)                  → suspended 4 Sep 2026
--   * 2 added by the admin by hand, for misconduct:
--       กมลชนก รุ่งเรือง (1012), อภิญญา คงสมบูรณ์ (1018)
-- To give them those absences it adds two finished events of fiscal year
-- 2569 — 1014 (Git & GitHub workshop, Sat 25 Jul 2026) and 1015 (cyber
-- security lecture, Wed 5 Aug 2026) — with some other students who did
-- attend. A suspended student can't register any more, so registrations the
-- demo data gave them after the day they were suspended (and never attended)
-- are removed.
--
-- Apply AFTER schema, seed, demo_organizer and seed_fy2569_moves (it builds on
-- their events 1010, 1011, 1013 and users). Safe to run again: it first
-- removes its own rows (events 1014–1015, registrations 101190–101199 /
-- 101390–101399, blacklist and activity-log ids 900011–900015).
--   docker exec -i cpsu-etms-mysql mysql --default-character-set=utf8mb4 -uroot cpsu_etms < database/seed_blacklist.sql
-- =====================================================================

USE cpsu_etms;
SET NAMES utf8mb4;
SET @t := DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR);

DELETE FROM blacklist_entries WHERE id BETWEEN 900011 AND 900015;
DELETE FROM activity_logs     WHERE id BETWEEN 900011 AND 900015;
DELETE FROM registrations     WHERE id BETWEEN 101190 AND 101199 OR id BETWEEN 101390 AND 101399;
DELETE FROM events            WHERE id IN (1014, 1015);   -- their registrations cascade

-- ------------------------------------------------------------------ two finished events of 2569 (copied from 1013's settings)
DROP TEMPORARY TABLE IF EXISTS tmp_ev;
CREATE TEMPORARY TABLE tmp_ev AS SELECT * FROM events WHERE id = 1013;

UPDATE tmp_ev SET id = 1014, title = 'อบรม Git และ GitHub สำหรับการทำงานเป็นทีม',
  description = 'อบรมเชิงปฏิบัติการการใช้ Git และ GitHub สำหรับการพัฒนาซอฟต์แวร์เป็นทีม ตั้งแต่พื้นฐานจนถึงขั้นตอนการทำงานร่วมกันแบบมืออาชีพ เหมาะสำหรับนักศึกษาที่กำลังจะทำโครงงานหรือฝึกงาน

💡 หัวข้อการอบรม
✅ พื้นฐาน Git: repository, commit, history และ .gitignore
✅ การแตก branch, merge และการแก้ merge conflict
✅ ทำงานบน GitHub: remote, push/pull, fork และ Pull Request
✅ Code Review และการจัดการงานด้วย Issues / GitHub Projects
✅ Workshop: ทำโปรเจกต์ร่วมกันเป็นทีมตั้งแต่ต้นจนจบ

🎤 วิทยากร อ.ดร.ณัฐพงศ์ จิวมั่งมี อาจารย์ประจำภาควิชาคอมพิวเตอร์

📅 วันเสาร์ที่ 25 กรกฎาคม 2569
⏰ เวลา 09.00 – 16.00 น.
📍 ห้องปฏิบัติการคอมพิวเตอร์ CS-205
💻 นำโน้ตบุ๊กมาเองได้ (ติดตั้ง Git และสมัครบัญชี GitHub ไว้ล่วงหน้า)',
  subcategory = 'Software Engineering', organizer_name = 'อ.ดร.ณัฐพงศ์ จิวมั่งมี', coordinator_id = 1046,
  date_start = '2026-07-25', date_end = NULL, time_range = '09.00–16.00 น.',
  reg_start = '2026-07-06', reg_end = '2026-07-23', created_at = '2026-07-01 10:00:00',
  place = 'ห้องปฏิบัติการคอมพิวเตอร์ CS-205', capacity = 25, poster_url = NULL,
  budget_planned = 10000, budget_other = 2000, budget_actual = 12650;
INSERT INTO events SELECT * FROM tmp_ev;

UPDATE tmp_ev SET id = 1015, title = 'บรรยาย: ความปลอดภัยไซเบอร์เบื้องต้นสำหรับนักศึกษา', category = 'อบรมเชิงบรรยาย',
  description = 'บรรยายความรู้ด้านความปลอดภัยไซเบอร์ที่นักศึกษาทุกคนควรรู้ รู้ทันภัยออนไลน์ใกล้ตัว ปกป้องบัญชีและข้อมูลส่วนตัวของตนเอง

💡 หัวข้อการบรรยาย
✅ การตั้งรหัสผ่านที่ปลอดภัยและการยืนยันตัวตนสองขั้นตอน (2FA)
✅ สังเกตและรับมืออีเมล ข้อความ และลิงก์ฟิชชิง (Phishing)
✅ ความเสี่ยงจาก Wi-Fi สาธารณะ และการใช้งานอย่างปลอดภัย
✅ ความเป็นส่วนตัวบนโซเชียลมีเดีย และพื้นฐาน PDPA
✅ กรณีศึกษาภัยไซเบอร์ที่เกิดขึ้นจริงกับนักศึกษา

🎤 วิทยากร อ.ดร.วัสรา รอดเหตุภัย อาจารย์ประจำภาควิชาคอมพิวเตอร์

📅 วันพุธที่ 5 สิงหาคม 2569
⏰ เวลา 13.00 – 16.00 น.
📍 ห้องประชุม SC-101 คณะวิทยาศาสตร์',
  subcategory = 'Security', organizer_name = 'อ.ดร.วัสรา รอดเหตุภัย', coordinator_id = 1048,
  date_start = '2026-08-05', date_end = NULL, time_range = '13.00–16.00 น.',
  reg_start = '2026-07-17', reg_end = '2026-08-03', created_at = '2026-07-14 10:00:00',
  place = 'ห้องประชุม SC-101 คณะวิทยาศาสตร์', capacity = 40, meals = 'break_pm',
  budget_planned = 10000, budget_other = NULL, budget_actual = 7800;
INSERT INTO events SELECT * FROM tmp_ev;
DROP TEMPORARY TABLE tmp_ev;

-- ------------------------------------------------------------------ who came to 1014 / 1015
INSERT INTO registrations (event_id, user_id, dept, status, checked_in, checked_in_at, registered_at)
SELECT e.id, u.id, u.dept, 'attended', 1,
       TIMESTAMP(e.date_start, IF(e.id = 1014, '08:50:00', '12:50:00')), TIMESTAMP(e.date_start - INTERVAL 10 DAY, '10:00:00')
FROM events e JOIN users u
  ON (e.id = 1014 AND u.id IN (1001, 1002, 1003, 1005, 1006, 1007, 1009, 1010))
  OR (e.id = 1015 AND u.id IN (1004, 1008, 1011, 1013, 1014, 1016, 1017, 1019, 1020));

INSERT INTO registration_checkins (registration_id, event_date, checked_in_at)
SELECT r.id, e.date_start, r.checked_in_at
FROM registrations r JOIN events e ON e.id = r.event_id
WHERE e.id IN (1014, 1015) AND r.checked_in = 1;

-- ------------------------------------------------------------------ the absences
-- 1028: 1013, 1014, 1015   1027: 1013 (already in demo data), 1014, 1015
-- 1024: 1014, 1015, 1011
INSERT INTO registrations (id, event_id, user_id, dept, status, registered_at)
SELECT x.id, x.event_id, u.id, u.dept, 'absent', TIMESTAMP(e.date_start - INTERVAL 12 DAY, '20:00:00')
FROM (SELECT 101390 AS id, 1013 AS event_id, 1028 AS user_id
      UNION ALL SELECT 101191, 1011, 1024) x
JOIN users u ON u.id = x.user_id JOIN events e ON e.id = x.event_id;

INSERT INTO registrations (event_id, user_id, dept, status, registered_at)
SELECT e.id, u.id, u.dept, 'absent', TIMESTAMP(e.date_start - INTERVAL 12 DAY, '20:00:00')
FROM events e JOIN users u
  ON (e.id = 1014 AND u.id IN (1028, 1027, 1024))
  OR (e.id = 1015 AND u.id IN (1028, 1027, 1024));

-- ------------------------------------------------------------------ the system's suspensions
-- Added the day after the 3rd absence, with the reason the system writes:
-- "ขาดกิจกรรมครบ 3 ครั้งในปีงบประมาณ พ.ศ. ...: <the 3 events>".
INSERT INTO blacklist_entries (id, user_id, name, email, student_id, reason, created_by, created_at)
SELECT 900010 + s.n, u.id, u.name, u.email, u.student_id,
       CONCAT('ขาดกิจกรรมครบ 3 ครั้งในปีงบประมาณ พ.ศ. ', YEAR(MAX(e.date_start)) + (MONTH(MAX(e.date_start)) >= 10) + 543,
              ' (ระบบเพิ่มอัตโนมัติ): ', GROUP_CONCAT(e.title ORDER BY e.date_start SEPARATOR ', ')),
       NULL, TIMESTAMP(MAX(e.date_start) + INTERVAL 1 DAY, '00:10:00')
FROM (SELECT 1 AS n, 1028 AS user_id UNION ALL SELECT 2, 1027 UNION ALL SELECT 3, 1024) s
JOIN users u ON u.id = s.user_id
JOIN registrations r ON r.user_id = u.id AND r.status = 'absent'
JOIN events e ON e.id = r.event_id AND e.is_listed = 1
-- the first three absences: those on or before the third-earliest one
WHERE (SELECT COUNT(*) FROM registrations r2 JOIN events e2 ON e2.id = r2.event_id
       WHERE r2.user_id = u.id AND r2.status = 'absent' AND e2.is_listed = 1 AND e2.date_start < e.date_start) < 3
GROUP BY s.n, u.id, u.name, u.email, u.student_id;

INSERT INTO activity_logs (id, user_id, action, detail, created_at)
SELECT b.id, NULL, 'BLACKLIST', CONCAT('ระบบเพิ่มรายชื่อ Blacklist อัตโนมัติ: ', b.name), b.created_at
FROM blacklist_entries b WHERE b.id BETWEEN 900011 AND 900013;

-- Once suspended they can't register: drop what the demo data had them sign
-- up for afterwards, unless they actually came.
DELETE r FROM registrations r
JOIN blacklist_entries b ON b.user_id = r.user_id AND b.id BETWEEN 900011 AND 900013
WHERE r.registered_at > b.created_at AND r.status IN ('registered', 'absent');

-- ------------------------------------------------------------------ the admin's (by hand)
INSERT INTO blacklist_entries (id, user_id, name, email, student_id, reason, created_by, created_at)
SELECT 900014, id, name, email, student_id, 'ฝากเพื่อนเซ็นชื่อแทนในใบเซ็นชื่อเข้าร่วมกิจกรรม แต่ไม่ได้มาเข้าร่วมจริง', 1,
       TIMESTAMP(@t - INTERVAL 2 DAY, '11:30:00') FROM users WHERE id = 1012;
INSERT INTO blacklist_entries (id, user_id, name, email, student_id, reason, created_by, created_at)
SELECT 900015, id, name, email, student_id, 'ให้ผู้อื่นทำแบบทดสอบก่อนอบรมและแบบประเมินแทน', 1,
       TIMESTAMP(@t - INTERVAL 9 DAY, '15:10:00') FROM users WHERE id = 1018;

INSERT INTO activity_logs (id, user_id, action, detail, created_at)
SELECT b.id, 1, 'BLACKLIST', CONCAT('เพิ่มรายชื่อ Blacklist: ', b.name), b.created_at
FROM blacklist_entries b WHERE b.id IN (900014, 900015);
