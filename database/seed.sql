-- =====================================================================
-- CPSU ETMS — minimal seed data for database/schema.sql
--
-- Just the three login accounts (one per role) — no demo events,
-- registrations, certificates, etc. Everything else starts empty so the
-- app can be used for real data from a clean slate.
--
-- Apply AFTER schema.sql:
--   mysql -u root -p cpsu_etms < database/schema.sql
--   mysql -u root -p cpsu_etms < database/seed.sql
--
-- All three accounts share the password "Passw0rd!" (bcrypt hash below —
-- swap in real hashes for anything beyond local dev).
-- =====================================================================

USE cpsu_etms;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE notifications;
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE blacklist_entries;
TRUNCATE TABLE sar_reports;
TRUNCATE TABLE evaluation_answers;
TRUNCATE TABLE evaluations;
TRUNCATE TABLE certificates;
TRUNCATE TABLE registrations;
TRUNCATE TABLE events;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- users (password for all: Passw0rd!)
-- ---------------------------------------------------------------------
INSERT INTO users (id, name, email, password_hash, role, student_id, dept, active) VALUES
  (1, 'ผศ.ดร. ปิยะ จันทรัศมี', 'piya_c@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'admin', NULL, 'หัวหน้าภาควิชาคอมพิวเตอร์', 1),
  (2, 'วรันธร สอนสงวน', 'krisada_p@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'organizer', NULL, 'อาจารย์ผู้ดูแลกิจกรรม', 1),
  (3, 'ภัทร ยะคำวุฒิ', 'phat_y@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'student', '670710001', 'นักศึกษาชั้นปีที่ 3 · วท.บ. คอมพิวเตอร์', 1);
