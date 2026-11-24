-- =====================================================================
-- Demo: move some of demo_organizer's events from fiscal year 2570 back into
-- 2569 (1 Oct 2025 – 30 Sep 2026), so both years have events whose posters
-- are still to be made. Every date that belongs to a moved event shifts by
-- the same number of days: the event's own dates and registration window,
-- and its registrations, check-ins, evaluations, certificates and SAR. All
-- targets fall in June–September 2026, the 2569 academic year, so the
-- students' years of study as they are now still hold.
--
--   1013  อบรมการเขียนโปรแกรม Mobile ด้วย Flutter     → Sat 18 Jul 2026 (already finished)
--   1011  บรรยาย: Cloud Computing กับธุรกิจยุคใหม่      → Thu  3 Sep 2026 (already finished)
--   1002  Workshop: พัฒนาเว็บด้วย React เบื้องต้น       → Sat  5 Sep 2026 (was upcoming)
--   1004  บรรยายพิเศษ: เส้นทางอาชีพสาย Data Science   → Fri 18 Sep 2026 (was upcoming)
--   1006  เสวนา Cybersecurity: รู้ทันภัยไซเบอร์         → Thu 24 Sep 2026 (was upcoming)
-- (1014 and 1015 are seed_blacklist's own and get their 2569 dates there.)
--
-- The three that were still to come are now finished and closed: who had
-- registered came (checked in), except one each, chosen among students with
-- no other absence that fiscal year; their evaluations and certificates come
-- from seed_certificates.sql.
--
-- Apply right AFTER demo_organizer (and before seed_blacklist, whose
-- suspensions count these absences). Safe to run again: each move is to a
-- fixed date, so a second run shifts by 0 days.
--   docker exec -i cpsu-etms-mysql mysql --default-character-set=utf8mb4 -uroot cpsu_etms < database/seed_fy2569_moves.sql
-- =====================================================================

USE cpsu_etms;
SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS tmp_move;
CREATE TEMPORARY TABLE tmp_move (event_id INT UNSIGNED PRIMARY KEY, target DATE, days INT);
INSERT INTO tmp_move (event_id, target) VALUES
  (1013, '2026-07-18'), (1011, '2026-09-03'), (1002, '2026-09-05'), (1004, '2026-09-18'), (1006, '2026-09-24');
UPDATE tmp_move m JOIN events e ON e.id = m.event_id SET m.days = DATEDIFF(m.target, e.date_start);

-- ------------------------------------------------------------------ shift everything that belongs to each event
UPDATE events e JOIN tmp_move m ON m.event_id = e.id
SET e.date_start = e.date_start + INTERVAL m.days DAY,
    e.date_end   = e.date_end   + INTERVAL m.days DAY,
    e.reg_start  = e.reg_start  + INTERVAL m.days DAY,
    e.reg_end    = e.reg_end    + INTERVAL m.days DAY,
    e.created_at = e.created_at + INTERVAL m.days DAY;

UPDATE registrations r JOIN tmp_move m ON m.event_id = r.event_id
SET r.registered_at     = r.registered_at     + INTERVAL m.days DAY,
    r.checked_in_at     = r.checked_in_at     + INTERVAL m.days DAY,
    r.cert_notified_at  = r.cert_notified_at  + INTERVAL m.days DAY,
    r.paid_at           = r.paid_at           + INTERVAL m.days DAY,
    r.slip_transferred_at = r.slip_transferred_at + INTERVAL m.days DAY,
    r.slip_submitted_at = r.slip_submitted_at + INTERVAL m.days DAY,
    r.refunded_at       = r.refunded_at       + INTERVAL m.days DAY;

UPDATE registration_checkins c JOIN registrations r ON r.id = c.registration_id JOIN tmp_move m ON m.event_id = r.event_id
SET c.event_date = c.event_date + INTERVAL m.days DAY, c.checked_in_at = c.checked_in_at + INTERVAL m.days DAY;

UPDATE evaluations v JOIN registrations r ON r.id = v.registration_id JOIN tmp_move m ON m.event_id = r.event_id
SET v.submitted_at = v.submitted_at + INTERVAL m.days DAY;

UPDATE certificates c JOIN registrations r ON r.id = c.registration_id JOIN tmp_move m ON m.event_id = r.event_id
SET c.issued_at = c.issued_at + INTERVAL m.days DAY;

UPDATE sar_reports s JOIN tmp_move m ON m.event_id = s.event_id
SET s.created_at = s.created_at + INTERVAL m.days DAY;

DROP TEMPORARY TABLE tmp_move;

-- ------------------------------------------------------------------ the three that were upcoming: held and closed
UPDATE events SET status = 'done', cycle_stage = 4, issue_certificate = 1 WHERE id IN (1002, 1004, 1006);
UPDATE events SET budget_actual = 14200 WHERE id = 1002;   -- of 12,000 + 3,000
UPDATE events SET budget_actual = 4300  WHERE id = 1004;   -- of 5,000
UPDATE events SET budget_actual = 11400 WHERE id = 1006;   -- of 8,000 + 4,000

-- Who had registered came, but one each: 1001 (React), 1013 (Data Science),
-- 1021 (Cybersecurity) — students with no other absence in fiscal year 2569.
UPDATE registrations r JOIN events e ON e.id = r.event_id
SET r.status = IF((r.event_id, r.user_id) IN ((1002, 1001), (1004, 1013), (1006, 1021)), 'absent', 'attended'),
    r.checked_in = IF((r.event_id, r.user_id) IN ((1002, 1001), (1004, 1013), (1006, 1021)), 0, 1),
    r.checked_in_at = IF((r.event_id, r.user_id) IN ((1002, 1001), (1004, 1013), (1006, 1021)), NULL,
                         TIMESTAMP(e.date_start, SEC_TO_TIME(TIME_TO_SEC(STR_TO_DATE(LEFT(e.time_range, 5), '%H.%i')) - 15 * 60 + (r.id % 20) * 60)))
WHERE e.id IN (1002, 1004, 1006) AND r.status = 'registered';

INSERT IGNORE INTO registration_checkins (registration_id, event_date, checked_in_at)
SELECT r.id, e.date_start, r.checked_in_at
FROM registrations r JOIN events e ON e.id = r.event_id
WHERE e.id IN (1002, 1004, 1006) AND r.checked_in = 1;
