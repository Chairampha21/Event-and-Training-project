-- =====================================================================
-- CPSU ETMS — ระบบจัดการกิจกรรมและการอบรม ภาควิชาคอมพิวเตอร์ ม.ศิลปากร
-- Database schema (MySQL 8 / MariaDB 10.5+, InnoDB, utf8mb4)
--
-- Mirrors the data model currently mocked in the frontend
-- (frontend/src/hooks/useEvents.js + frontend/src/data/*) so the app can
-- swap its localStorage-backed store for a real backend without changing
-- shape: events, registrations/roster+check-in, certificates, evaluations,
-- SAR reports, blacklist, activity log, and per-user notifications.
--
-- Apply with:  mysql -u root -p < database/schema.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS cpsu_etms
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cpsu_etms;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- users — one account per role (admin / organizer / student)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150)      NOT NULL,
  email           VARCHAR(190)      NOT NULL,
  password_hash   VARCHAR(255)      NOT NULL,             -- bcrypt/argon2 hash — never store plaintext
  role            ENUM('admin','organizer','student') NOT NULL DEFAULT 'student',
  student_id      VARCHAR(20)       NULL,                 -- รหัสนักศึกษา เช่น 64xxxxx21 (students only)
  dept            VARCHAR(190)      NULL,                 -- สังกัด/ตำแหน่ง (staff) หรือ ชั้นปี · สาขา (students)
  active          TINYINT(1)        NOT NULL DEFAULT 1,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT chk_users_email_domain CHECK (email LIKE '%@silpakorn.edu')
) ENGINE=InnoDB;

CREATE INDEX idx_users_role ON users (role);

-- ---------------------------------------------------------------------
-- events — one row per activity/training, covers the full create-event form
-- ---------------------------------------------------------------------
CREATE TABLE events (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title                 VARCHAR(255)  NOT NULL,
  description           TEXT          NULL,
  category              VARCHAR(50)   NOT NULL,           -- สัมมนา / Workshop / การแข่งขัน / Cybersecurity
  subcategory           VARCHAR(150)  NULL,                -- e.g. 'AI / Data', 'Hackathon'
  poster_url            LONGTEXT      NULL,               -- the frontend stores this as a base64 data: URL, not a path

  organizer_id          INT UNSIGNED  NULL,                -- account that owns/manages this event
  organizer_name        VARCHAR(190)  NULL,                -- display text (may be a club/committee, not a login)

  day_mode              ENUM('single','multi') NOT NULL DEFAULT 'single',
  date_start            DATE          NOT NULL,
  date_end              DATE          NULL,                -- multi-day events only
  time_range            VARCHAR(100)  NULL,                -- free text: '09:00–16:00 น.', 'เต็มวัน', '36 ชั่วโมง'

  attend_mode           ENUM('onsite','online','hybrid') NOT NULL DEFAULT 'onsite',
  place                 VARCHAR(255)  NULL,
  online_link           VARCHAR(500)  NULL,
  capacity              INT UNSIGNED  NOT NULL DEFAULT 0,   -- total seats (onsite-only or online-only events)
  capacity_onsite       INT UNSIGNED  NULL,                 -- hybrid events only
  capacity_online       INT UNSIGNED  NULL,                 -- hybrid events only

  status                ENUM('open','closed','soon','full','done') NOT NULL DEFAULT 'soon',
  cycle_stage           TINYINT UNSIGNED NOT NULL DEFAULT 0, -- 0=ประกาศ 1=รับสมัคร 2=จัดกิจกรรม 3=เกียรติบัตร

  pretest_enabled       TINYINT(1)    NOT NULL DEFAULT 0,
  pretest_link          VARCHAR(500)  NULL,
  pretest_pass_pct      TINYINT UNSIGNED NULL,
  pretest_time_limit_min SMALLINT UNSIGNED NULL,

  cert_template_url     LONGTEXT      NULL,               -- also a base64 data: URL from the frontend
  cert_signer_name      VARCHAR(190)  NULL,
  cert_signer_title     VARCHAR(190)  NULL,

  email_on_register     TINYINT(1)    NOT NULL DEFAULT 1,
  email_before_event    TINYINT(1)    NOT NULL DEFAULT 1,
  email_after_event     TINYINT(1)    NOT NULL DEFAULT 0,

  is_listed             TINYINT(1)    NOT NULL DEFAULT 1,   -- soft-delete flag (matches deleteEvent -> listed=false)

  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_events_capacity_hybrid CHECK (
    attend_mode <> 'hybrid' OR (capacity_onsite IS NOT NULL AND capacity_online IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE INDEX idx_events_status ON events (status);
CREATE INDEX idx_events_category ON events (category);
CREATE INDEX idx_events_date_start ON events (date_start);
CREATE INDEX idx_events_organizer ON events (organizer_id);

-- ---------------------------------------------------------------------
-- registrations — one row per (event, student); doubles as the
-- organizer-facing roster with on-site check-in state
-- ---------------------------------------------------------------------
CREATE TABLE registrations (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id        INT UNSIGNED  NOT NULL,
  user_id         INT UNSIGNED  NOT NULL,
  status          ENUM('registered','attended','certified','absent') NOT NULL DEFAULT 'registered',
  checked_in      TINYINT(1)    NOT NULL DEFAULT 0,
  checked_in_at   DATETIME      NULL,
  registered_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reg_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_reg_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT uq_reg_event_user UNIQUE (event_id, user_id)
) ENGINE=InnoDB;

CREATE INDEX idx_reg_event ON registrations (event_id);
CREATE INDEX idx_reg_user ON registrations (user_id);
CREATE INDEX idx_reg_status ON registrations (status);

-- ---------------------------------------------------------------------
-- certificates — issued once a registration reaches 'certified'
-- ---------------------------------------------------------------------
CREATE TABLE certificates (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  registration_id  BIGINT UNSIGNED NOT NULL,
  cert_code        VARCHAR(50)     NOT NULL,   -- รหัสตรวจสอบ เช่น SU-CS-2568-018
  issued_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pdf_url          VARCHAR(500)    NULL,
  CONSTRAINT fk_cert_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  CONSTRAINT uq_cert_registration UNIQUE (registration_id),
  CONSTRAINT uq_cert_code UNIQUE (cert_code)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- evaluation_questions — the fixed post-event survey (seeded below)
-- ---------------------------------------------------------------------
CREATE TABLE evaluation_questions (
  id          TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  q_key       VARCHAR(30)   NOT NULL,   -- overall / content / speaker / venue
  label       VARCHAR(255)  NOT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT uq_eval_question_key UNIQUE (q_key)
) ENGINE=InnoDB;

CREATE TABLE evaluations (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  registration_id  BIGINT UNSIGNED NOT NULL,
  submitted_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_eval_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  CONSTRAINT uq_eval_registration UNIQUE (registration_id)
) ENGINE=InnoDB;

CREATE TABLE evaluation_answers (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  evaluation_id  BIGINT UNSIGNED NOT NULL,
  question_id    TINYINT UNSIGNED NOT NULL,
  score          TINYINT UNSIGNED NOT NULL,
  CONSTRAINT fk_ans_evaluation FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
  CONSTRAINT fk_ans_question   FOREIGN KEY (question_id)   REFERENCES evaluation_questions(id),
  CONSTRAINT uq_ans_eval_question UNIQUE (evaluation_id, question_id),
  CONSTRAINT chk_ans_score CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- sar_reports — Self Assessment Report, one per finished event
-- ---------------------------------------------------------------------
CREATE TABLE sar_reports (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id      INT UNSIGNED  NOT NULL,
  report_code   VARCHAR(30)   NOT NULL,      -- เช่น SAR-2568-002
  purpose       TEXT          NULL,          -- วัตถุประสงค์
  outcome       TEXT          NULL,          -- ผลลัพธ์การเรียนรู้
  gaps          TEXT          NULL,          -- ข้อค้นพบ/ช่องว่าง
  improvement   TEXT          NULL,          -- แนวทางปรับปรุง
  status        ENUM('draft','final') NOT NULL DEFAULT 'draft',
  created_by    INT UNSIGNED  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sar_event   FOREIGN KEY (event_id)   REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_sar_creator FOREIGN KEY (created_by) REFERENCES users(id)  ON DELETE SET NULL,
  CONSTRAINT uq_sar_event UNIQUE (event_id),
  CONSTRAINT uq_sar_code UNIQUE (report_code)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- blacklist_entries — participants suspended from registering
-- ---------------------------------------------------------------------
CREATE TABLE blacklist_entries (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED  NULL,          -- linked account, if one exists
  name          VARCHAR(190)  NOT NULL,
  email         VARCHAR(190)  NULL,
  student_id    VARCHAR(20)   NULL,
  reason        TEXT          NOT NULL,
  created_by    INT UNSIGNED  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  restored_at   TIMESTAMP     NULL,          -- non-null once the suspension is lifted
  CONSTRAINT fk_blacklist_user    FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_blacklist_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_blacklist_email ON blacklist_entries (email);
CREATE INDEX idx_blacklist_student_id ON blacklist_entries (student_id);
CREATE INDEX idx_blacklist_active ON blacklist_entries (restored_at);

-- ---------------------------------------------------------------------
-- activity_logs — system-wide audit trail
-- ---------------------------------------------------------------------
CREATE TABLE activity_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED  NULL,            -- NULL = SYSTEM (cron/automated actions)
  action      VARCHAR(50)   NOT NULL,        -- CREATE / UPDATE / DELETE / REGISTER / CHECKIN / ISSUE / BLACKLIST / EMAIL ...
  detail      TEXT          NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_log_created_at ON activity_logs (created_at);
CREATE INDEX idx_log_user ON activity_logs (user_id);

-- ---------------------------------------------------------------------
-- notifications — per-user bell notifications
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED  NOT NULL,
  icon        VARCHAR(50)   NULL,
  tone        VARCHAR(20)   NULL,
  title       VARCHAR(190)  NOT NULL,
  message     VARCHAR(500)  NULL,
  is_read     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_notif_user_unread ON notifications (user_id, is_read);

-- =====================================================================
-- Views — support the dashboard/report pages directly with plain SELECTs
-- =====================================================================

-- Per-event roll-up: used by the organizer "ผู้เข้าร่วม" table and ReportPage
CREATE OR REPLACE VIEW v_event_stats AS
SELECT
  e.id                                            AS event_id,
  e.title,
  e.category,
  e.date_start,
  COUNT(r.id)                                     AS registered_count,
  SUM(r.checked_in)                               AS checked_in_count,
  SUM(r.status = 'certified')                     AS certified_count,
  ROUND(SUM(r.checked_in) / NULLIF(COUNT(r.id), 0) * 100, 1) AS attend_rate_pct
FROM events e
LEFT JOIN registrations r ON r.event_id = e.id
WHERE e.is_listed = 1
GROUP BY e.id, e.title, e.category, e.date_start;

-- Yearly roll-up by category: backs the "Dashboard รายปี" page
CREATE OR REPLACE VIEW v_dashboard_yearly AS
SELECT
  YEAR(e.date_start)      AS report_year,
  e.category,
  COUNT(DISTINCT e.id)    AS event_count,
  COUNT(DISTINCT r.id)    AS participant_count,
  COUNT(DISTINCT CASE WHEN r.status = 'certified' THEN r.id END) AS certificate_count,
  ROUND(AVG(ea.score), 2) AS avg_satisfaction
FROM events e
LEFT JOIN registrations r ON r.event_id = e.id
LEFT JOIN evaluations ev ON ev.registration_id = r.id
LEFT JOIN evaluation_answers ea ON ea.evaluation_id = ev.id
WHERE e.is_listed = 1 AND e.status = 'done'
GROUP BY YEAR(e.date_start), e.category;

-- =====================================================================
-- Required reference data
-- =====================================================================
INSERT INTO evaluation_questions (q_key, label, sort_order) VALUES
  ('overall', 'ความพึงพอใจโดยรวมต่อกิจกรรม', 1),
  ('content', 'เนื้อหาครอบคลุมความต้องการและทันสมัย', 2),
  ('speaker', 'วิทยากร / ผู้บรรยาย ถ่ายทอดเข้าใจง่าย', 3),
  ('venue',   'สถานที่ อุปกรณ์ และการจัดการเวลา', 4);

-- =====================================================================
-- Optional demo seed data — mirrors frontend/src/utils/constants.js
-- MOCK_ACCOUNTS. Remove this block for a production deployment; the
-- password hashes below are placeholders and MUST be replaced with real
-- bcrypt/argon2 hashes generated by the application before use.
-- =====================================================================
-- INSERT INTO users (name, email, password_hash, role, dept) VALUES
--   ('ผศ.ดร. ปิยะ จันทรัศมี',  'piya_c@silpakorn.edu',    '$2y$10$REPLACE_WITH_REAL_HASH', 'admin',     'หัวหน้าภาควิชาคอมพิวเตอร์'),
--   ('วรันธร สอนสงวน',         'krisada_p@silpakorn.edu', '$2y$10$REPLACE_WITH_REAL_HASH', 'organizer', 'อาจารย์ผู้ดูแลกิจกรรม'),
--   ('ภัทร ยะคำวุฒิ',          'phat_y@silpakorn.edu',    '$2y$10$REPLACE_WITH_REAL_HASH', 'student',   'นักศึกษาชั้นปีที่ 3 · วท.บ. คอมพิวเตอร์');
