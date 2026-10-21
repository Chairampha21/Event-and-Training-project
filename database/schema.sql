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
-- users — one account per role (admin / organizer / teacher / student)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150)      NOT NULL,             -- Thai first and last name, without the title
  -- Title and English name, for certificates (Thai, and English ones later).
  -- Shown together as title + name: "นาย"/"นางสาว"/"เด็กชาย"... join without a
  -- space ("นายสมชาย ใจดี"), as do abbreviations ending in "." ("ผศ.ดร.สมชาย").
  -- Existing databases: ALTER TABLE users ADD COLUMN title_th VARCHAR(40) NULL AFTER name,
  --   ADD COLUMN name_en VARCHAR(150) NULL AFTER title_th, ADD COLUMN title_en VARCHAR(40) NULL AFTER name_en;
  -- then move titles typed into names into title_th (see the UPDATEs in database/migrations/2026-10-names.sql).
  title_th        VARCHAR(40)       NULL,
  name_en         VARCHAR(150)      NULL,                 -- English first and last name, without the title
  title_en        VARCHAR(40)       NULL,
  email           VARCHAR(190)      NOT NULL,
  password_hash   VARCHAR(255)      NOT NULL,             -- bcrypt/argon2 hash — never store plaintext
  -- teacher: joins events like a student (register, check in, evaluate,
  -- certificates) but has no student ID. Only an admin assigns it.
  -- Existing databases: ALTER TABLE users MODIFY role ENUM('admin','organizer','teacher','student') NOT NULL DEFAULT 'student';
  role            ENUM('admin','organizer','teacher','student') NOT NULL DEFAULT 'student',
  student_id      VARCHAR(20)       NULL,                 -- รหัสนักศึกษา เช่น 64xxxxx21 (students only)
  dept            VARCHAR(190)      NULL,                 -- สังกัด/ตำแหน่ง (staff) หรือ ชั้นปี · สาขา (students)
  active          TINYINT(1)        NOT NULL DEFAULT 1,
  -- When the owner proved the address is theirs (a code sent to it, Google
  -- Sign-In, or an admin creating the account). A self sign-up can't log in
  -- until then, so only people with a real @silpakorn.edu mailbox get in.
  -- Existing databases: ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL AFTER active;
  --                     UPDATE users SET email_verified_at = UTC_TIMESTAMP();
  email_verified_at DATETIME        NULL,
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
  category              VARCHAR(50)   NOT NULL,           -- อบรมเชิงบรรยาย / อบรมเชิงปฏิบัติการ / การแข่งขัน / Cybersecurity
  subcategory           VARCHAR(150)  NULL,                -- e.g. 'AI / Data', 'Hackathon'
  poster_url            LONGTEXT      NULL,               -- the frontend stores this as a base64 data: URL, not a path

  organizer_id          INT UNSIGNED  NULL,                -- account that owns/manages this event
  organizer_name        VARCHAR(190)  NULL,                -- display text (may be a club/committee, not a login)

  day_mode              ENUM('single','multi') NOT NULL DEFAULT 'single',
  date_start            DATE          NOT NULL,
  date_end              DATE          NULL,                -- multi-day events only
  -- multi-day events: the exact days picked, comma-separated ISO dates in order
  -- ('2026-10-23,2026-10-25') — they need not be consecutive. date_start/date_end
  -- always hold the first/last of these. NULL for single-day events.
  -- Existing databases: ALTER TABLE events ADD COLUMN event_dates VARCHAR(2000) NULL AFTER date_end;
  event_dates           VARCHAR(2000) NULL,
  -- multi-day events: each picked day's own time, 'HH:MM-HH:MM', comma-separated
  -- and aligned one-to-one with event_dates ('09:00-12:00,13:00-16:00') — days
  -- can run at different times. NULL when no per-day times were set.
  -- Existing databases: ALTER TABLE events ADD COLUMN event_times VARCHAR(2000) NULL AFTER event_dates;
  event_times           VARCHAR(2000) NULL,
  time_range            VARCHAR(100)  NULL,                -- free text: '09:00–16:00 น.', 'เต็มวัน', '36 ชั่วโมง'

  -- registration window (inclusive, Thai local dates). NULL = no limit on that side.
  -- Existing databases: ALTER TABLE events ADD COLUMN reg_start DATE NULL AFTER time_range, ADD COLUMN reg_end DATE NULL AFTER reg_start;
  reg_start             DATE          NULL,
  reg_end               DATE          NULL,

  attend_mode           ENUM('onsite','online','hybrid') NOT NULL DEFAULT 'onsite',
  place                 VARCHAR(255)  NULL,
  online_link           VARCHAR(500)  NULL,
  capacity              INT UNSIGNED  NOT NULL DEFAULT 0,   -- total seats (onsite-only or online-only events)
  capacity_onsite       INT UNSIGNED  NULL,                 -- hybrid events only
  capacity_online       INT UNSIGNED  NULL,                 -- hybrid events only

  -- budget in baht, split by funding source as in the department's plan:
  -- budget_planned = งบประมาณเงินรายได้ (department income), budget_other =
  -- งบประมาณแหล่งอื่น (any other source); the event's total budget is their sum.
  -- Both are set when the event is created. budget_actual is the amount really
  -- spent, recorded once the event has finished. NULL = not set.
  -- Existing databases: ALTER TABLE events ADD COLUMN budget_planned DECIMAL(12,2) NULL AFTER capacity_online, ADD COLUMN budget_other DECIMAL(12,2) NULL AFTER budget_planned, ADD COLUMN budget_actual DECIMAL(12,2) NULL AFTER budget_other;
  budget_planned        DECIMAL(12,2) NULL,
  budget_other          DECIMAL(12,2) NULL,
  budget_actual         DECIMAL(12,2) NULL,

  -- attendee_note: a message from the organizer shown to people registering
  -- (e.g. 'ให้นำโน้ตบุ๊กส่วนตัวมาด้วย'). loan_laptop_qty: how many notebooks the
  -- organizer can lend for this event; students ask for one when they register
  -- (registrations.wants_laptop). NULL = nothing to lend.
  -- Existing databases: ALTER TABLE events ADD COLUMN attendee_note VARCHAR(500) NULL AFTER budget_actual, ADD COLUMN loan_laptop_qty INT UNSIGNED NULL AFTER attendee_note;
  --                     ALTER TABLE registrations ADD COLUMN wants_laptop TINYINT(1) NOT NULL DEFAULT 0 AFTER checked_in_at;
  attendee_note         VARCHAR(500)  NULL,
  loan_laptop_qty       INT UNSIGNED  NULL,
  -- ask_dietary: the event serves food, so registrants are asked about food
  -- allergies and dietary needs (registrations.food_allergy / dietary_pref).
  -- Existing databases: ALTER TABLE events ADD COLUMN ask_dietary TINYINT(1) NOT NULL DEFAULT 0 AFTER loan_laptop_qty;
  --                     ALTER TABLE registrations ADD COLUMN food_allergy VARCHAR(300) NULL AFTER wants_laptop, ADD COLUMN dietary_pref VARCHAR(100) NULL AFTER food_allergy;
  ask_dietary           TINYINT(1)    NOT NULL DEFAULT 0,
  -- issue_certificate: the event gives certificates. When off, the sign-in
  -- sheet has one signature box per day instead of morning/afternoon, and
  -- certificates cannot be issued.
  -- Existing databases: ALTER TABLE events ADD COLUMN issue_certificate TINYINT(1) NOT NULL DEFAULT 1 AFTER ask_dietary;
  issue_certificate     TINYINT(1)    NOT NULL DEFAULT 1,

  -- fee: registration fee in baht; NULL or 0 = free. payment_info: how to pay
  -- (account / PromptPay, deadline), shown to people registering. Payment is
  -- made outside the system; the organizer confirms it per registration
  -- (registrations.payment_status).
  -- Existing databases: ALTER TABLE events ADD COLUMN fee DECIMAL(10,2) NULL AFTER ask_dietary, ADD COLUMN payment_info VARCHAR(500) NULL AFTER fee;
  --                     ALTER TABLE registrations ADD COLUMN payment_status ENUM('none','pending','paid') NOT NULL DEFAULT 'none' AFTER dietary_pref, ADD COLUMN paid_at DATETIME NULL AFTER payment_status;
  fee                   DECIMAL(10,2) NULL,
  payment_info          VARCHAR(500)  NULL,
  -- refund_method: what happens to the money if it is given back (set with the
  -- fee, editable later): 'none' = not refunded, 'department' = collected at the
  -- department (e.g. a deposit returned at the door), 'transfer' = transferred
  -- back to the payer's PromptPay (asked for with the slip). refund_note: when
  -- and where, in the organizer's words. If the event is cancelled, everyone who
  -- paid is refunded this way (cancelling an event set to 'none' asks for a method).
  -- Existing databases: ALTER TABLE events ADD COLUMN refund_method ENUM('none','department','transfer') NOT NULL DEFAULT 'none' AFTER payment_info,
  --                       ADD COLUMN refund_note VARCHAR(300) NULL AFTER refund_method;
  refund_method         ENUM('none','department','transfer') NOT NULL DEFAULT 'none',
  refund_note           VARCHAR(300)  NULL,

  status                ENUM('open','closed','soon','full','done') NOT NULL DEFAULT 'soon',
  cycle_stage           TINYINT UNSIGNED NOT NULL DEFAULT 0, -- 0=ประกาศ 1=รับสมัคร 2=จัดกิจกรรม 3=เกียรติบัตร 4=ปิดกิจกรรม

  pretest_enabled       TINYINT(1)    NOT NULL DEFAULT 0,
  pretest_link          VARCHAR(500)  NULL,
  pretest_pass_pct      TINYINT UNSIGNED NULL,
  pretest_time_limit_min SMALLINT UNSIGNED NULL,

  cert_template_url     LONGTEXT      NULL,               -- also a base64 data: URL from the frontend
  cert_signer_name      VARCHAR(190)  NULL,
  cert_signer_title     VARCHAR(190)  NULL,
  -- the signer's scanned signature (base64 data: URL, PNG/JPG), printed above their name.
  -- Existing databases: ALTER TABLE events ADD COLUMN cert_signature_url MEDIUMTEXT NULL AFTER cert_signer_title;
  cert_signature_url    MEDIUMTEXT    NULL,
  -- how the system's text is fitted to this event's template (JSON: positions,
  -- text size, ink tone, whether to show the organisation line). NULL = default layout.
  -- Existing databases: ALTER TABLE events ADD COLUMN cert_layout VARCHAR(500) NULL AFTER cert_signature_url;
  cert_layout           VARCHAR(500)  NULL,

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
  -- When this person was told the certificate is open (evaluation waiting); NULL = not yet.
  -- Existing databases: ALTER TABLE registrations ADD COLUMN cert_notified_at DATETIME NULL AFTER checked_in_at;
  cert_notified_at DATETIME NULL,
  -- How this person attends. An event held one way gives everyone that way; a
  -- hybrid event has the registrant choose, with separate seats for each.
  -- Online attendees check in themselves through the day's self check-in link.
  -- Existing databases: ALTER TABLE registrations ADD COLUMN attend_via ENUM('onsite','online') NOT NULL DEFAULT 'onsite' AFTER status;
  --   UPDATE registrations r JOIN events e ON e.id = r.event_id SET r.attend_via = 'online' WHERE e.attend_mode = 'online';
  attend_via      ENUM('onsite','online') NOT NULL DEFAULT 'onsite',
  wants_laptop    TINYINT(1)    NOT NULL DEFAULT 0,        -- asked to borrow one of the event's loan notebooks
  -- Health-related: shown only to the registrant, the event's organizer and admins,
  -- and used only to prepare food. '' / NULL = nothing declared.
  food_allergy    VARCHAR(300)  NULL,                      -- what the registrant is allergic to
  dietary_pref    VARCHAR(100)  NULL,                      -- e.g. มังสวิรัติ, ฮาลาล
  -- Payment of a paid event's fee, made outside the system and proven with a slip:
  --   none      free event, nothing to pay
  --   pending   registered, no slip sent yet
  --   submitted slip sent, waiting for the organizer to check it
  --   rejected  organizer could not accept the slip (see payment_reject_reason); the payer sends another
  --   paid      organizer confirmed
  --   refunded  organizer gave the money back (refunded_at); see events.refund_method
  -- Existing databases: ALTER TABLE registrations MODIFY payment_status ENUM('none','pending','submitted','rejected','paid') NOT NULL DEFAULT 'none',
  --   ADD COLUMN slip_url MEDIUMTEXT NULL AFTER paid_at, ADD COLUMN slip_transferred_at DATETIME NULL AFTER slip_url,
  --   ADD COLUMN slip_amount DECIMAL(10,2) NULL AFTER slip_transferred_at, ADD COLUMN slip_submitted_at DATETIME NULL AFTER slip_amount,
  --   ADD COLUMN payment_reject_reason VARCHAR(200) NULL AFTER slip_submitted_at;
  -- Refunds — existing databases: ALTER TABLE registrations MODIFY payment_status ENUM('none','pending','submitted','rejected','paid','refunded') NOT NULL DEFAULT 'none',
  --   ADD COLUMN refunded_at DATETIME NULL AFTER payment_reject_reason, ADD COLUMN refund_promptpay VARCHAR(13) NULL AFTER refunded_at;
  payment_status  ENUM('none','pending','submitted','rejected','paid','refunded') NOT NULL DEFAULT 'none',
  paid_at         DATETIME      NULL,                      -- when the organizer confirmed the payment (server time, UTC)
  slip_url        MEDIUMTEXT    NULL,                      -- transfer slip image (base64 data: URL), visible to the payer, the organizer and admins only
  slip_transferred_at DATETIME  NULL,                      -- date and time of the transfer as the payer entered it (Thai local time)
  slip_amount     DECIMAL(10,2) NULL,                      -- amount the payer says they transferred
  slip_submitted_at DATETIME    NULL,                      -- when the slip was sent in (server time, UTC)
  payment_reject_reason VARCHAR(200) NULL,
  refunded_at     DATETIME      NULL,                      -- when the organizer marked the money as given back (server time, UTC)
  refund_promptpay VARCHAR(13)  NULL,                      -- payer's PromptPay (phone or citizen ID, digits only) for a 'transfer' refund
  registered_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reg_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_reg_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT uq_reg_event_user UNIQUE (event_id, user_id)
) ENGINE=InnoDB;

-- One row per day of the event a registrant was checked in on. An event that
-- runs over several days is checked day by day; registrations.checked_in = 1
-- (and status 'attended') means every day of the event has a row here.
-- A registrant with no row at all once the event is over is the one marked 'absent'.
-- Existing databases: create this table, then
--   INSERT IGNORE INTO registration_checkins (registration_id, event_date, checked_in_at)
--   SELECT r.id, e.date_start, COALESCE(r.checked_in_at, NOW()) FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.checked_in = 1;
CREATE TABLE registration_checkins (
  registration_id BIGINT UNSIGNED NOT NULL,
  event_date      DATE            NOT NULL,
  checked_in_at   DATETIME        NOT NULL,
  PRIMARY KEY (registration_id, event_date),
  CONSTRAINT fk_checkin_reg FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
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
  -- the department's main template (cert_templates) when it was issued, for an
  -- event without a template of its own; NULL = the template built into the site
  default_template_id INT UNSIGNED  NULL,
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
-- event_evaluation_questions — extra per-event questions an organizer adds
-- on top of the fixed standard survey above (optional, set at/after creation)
-- ---------------------------------------------------------------------
CREATE TABLE event_evaluation_questions (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id       INT UNSIGNED NOT NULL,
  label          VARCHAR(255) NOT NULL,
  sort_order     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  question_type  ENUM('scale','choice') NOT NULL DEFAULT 'scale',
  options        TEXT NULL,   -- JSON array of option labels, choice-type only
  required       TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_eeq_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_eeq_event ON event_evaluation_questions (event_id);

CREATE TABLE event_evaluation_answers (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  evaluation_id  BIGINT UNSIGNED NOT NULL,
  question_id    INT UNSIGNED NOT NULL,
  score          TINYINT UNSIGNED NULL,
  answer_text    VARCHAR(255) NULL,  -- chosen option, choice-type questions
  CONSTRAINT fk_eea_evaluation FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
  CONSTRAINT fk_eea_question   FOREIGN KEY (question_id)   REFERENCES event_evaluation_questions(id) ON DELETE CASCADE,
  CONSTRAINT uq_eea_eval_question UNIQUE (evaluation_id, question_id),
  CONSTRAINT chk_eea_score CHECK (score IS NULL OR score BETWEEN 1 AND 5),
  CONSTRAINT chk_eea_answer_shape CHECK ((score IS NULL) <> (answer_text IS NULL))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- sar_reports — Self Assessment Report, one per finished event
-- ---------------------------------------------------------------------
CREATE TABLE sar_reports (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id          INT UNSIGNED  NOT NULL,
  report_code       VARCHAR(30)   NOT NULL,      -- เช่น SAR-2568-002
  -- A base64 data: URL of the image, so TEXT (64 KB) is far too small — an ordinary poster is hundreds of KB.
  -- Existing databases: ALTER TABLE sar_reports MODIFY recap_poster_url MEDIUMTEXT NULL;
  recap_poster_url  MEDIUMTEXT    NULL,          -- โปสเตอร์สรุปข่าวหลังจบกิจกรรม
  purpose       TEXT          NULL,          -- วัตถุประสงค์ (เดิม — ไม่ใช้แล้ว)
  outcome       TEXT          NULL,          -- ผลลัพธ์การเรียนรู้ (เดิม — ไม่ใช้แล้ว)
  gaps          TEXT          NULL,          -- ข้อค้นพบ/ช่องว่าง (เดิม — ไม่ใช้แล้ว)
  improvement   TEXT          NULL,          -- แนวทางปรับปรุง (เดิม — ไม่ใช้แล้ว)
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
  -- in-app path the bell opens when the notification is pressed: the place where
  -- what it talks about can be seen or finished ('/events?applicants=12'). NULL = nowhere.
  -- Existing databases: ALTER TABLE notifications ADD COLUMN link VARCHAR(200) NULL AFTER message;
  link        VARCHAR(200)  NULL,
  is_read     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_notif_user_unread ON notifications (user_id, is_read);



-- ---------------------------------------------------------------------
-- email_codes — 6-digit one-time codes mailed to a user: to confirm the
-- address after signing up ('verify') or to set a new password ('reset').
-- Only a hash is kept. A code lasts 15 minutes and allows 5 tries.
-- Existing databases: run this CREATE TABLE as it is.
-- ---------------------------------------------------------------------
CREATE TABLE email_codes (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED  NOT NULL,
  purpose         ENUM('verify','reset') NOT NULL,
  code_hash       CHAR(64)      NOT NULL,
  attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at      DATETIME      NOT NULL,                  -- UTC
  used_at         DATETIME      NULL,
  created_at      DATETIME      NOT NULL,                  -- UTC
  CONSTRAINT fk_emailcode_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE INDEX idx_emailcode_user ON email_codes (user_id, purpose, created_at);

-- ---------------------------------------------------------------------
-- cert_templates — every version of the department's main certificate
-- template an admin has saved (image + how text is fitted to it). A version is
-- never changed once saved, so a certificate keeps the look it was issued with.
-- cert_defaults — the current defaults (one row, id = 1): which version is the
-- main template now (NULL = the template built into the site) and the signer
-- new events start with.
-- Existing databases: run these CREATE TABLEs as they are, and
--   ALTER TABLE certificates ADD COLUMN default_template_id INT UNSIGNED NULL AFTER cert_code;
-- ---------------------------------------------------------------------
CREATE TABLE cert_templates (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_url    MEDIUMTEXT    NOT NULL,                  -- data: URL (JPG/PNG)
  layout          VARCHAR(500)  NULL,                      -- same JSON as events.cert_layout
  created_by      INT UNSIGNED  NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_certtpl_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE cert_defaults (
  id              TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  template_id     INT UNSIGNED  NULL,                      -- NULL = the template built into the site
  signer_name     VARCHAR(190)  NULL,
  signer_title    VARCHAR(190)  NULL,
  signature_url   MEDIUMTEXT    NULL,
  updated_by      INT UNSIGNED  NULL,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_certdef_template FOREIGN KEY (template_id) REFERENCES cert_templates(id),
  CONSTRAINT fk_certdef_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- reminder_log — which time-based reminders have already gone out, so the
-- periodic job (backend/internal/reminders) never sends one twice.
--   kind     which rule (event_tomorrow, reg_closed, post_event, ...)
--   ref_id   what it is about (a registration id, an event id, a yyyymmdd day)
--   user_id  who it went to (0 = a broadcast)
--   step     1 = first reminder, 2 = the single follow-up
-- Existing databases: run this CREATE TABLE as it is.
-- ---------------------------------------------------------------------
CREATE TABLE reminder_log (
  kind     VARCHAR(40)      NOT NULL,
  ref_id   BIGINT           NOT NULL,
  user_id  BIGINT           NOT NULL DEFAULT 0,
  step     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  sent_at  TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (kind, ref_id, user_id, step)
) ENGINE=InnoDB;

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

-- Fiscal-year roll-up by category: backs the "Dashboard รายปี" page
-- avg_satisfaction reads from event_evaluation_answers (each event's own
-- scale-type questions) since the fixed standard 4 questions are no longer
-- shown on the student evaluation form — evaluation_answers stays populated
-- only with legacy pre-cutover data and would otherwise go stale.
CREATE OR REPLACE VIEW v_dashboard_yearly AS
SELECT
  -- Thai fiscal year (ปีงบประมาณ), Buddhist era: 1 Oct – 30 Sep, named after the
  -- year it ends in. So Oct 2025 – Sep 2026 is ปีงบประมาณ พ.ศ. 2569.
  YEAR(e.date_start) + (MONTH(e.date_start) >= 10) + 543 AS report_year,
  e.category,
  COUNT(DISTINCT e.id)    AS event_count,
  COUNT(DISTINCT r.id)    AS participant_count,
  COUNT(DISTINCT CASE WHEN r.status = 'certified' THEN r.id END) AS certificate_count,
  ROUND(AVG(eea.score), 2) AS avg_satisfaction
FROM events e
-- Teachers join events like students but are not counted in the dashboard.
LEFT JOIN registrations r ON r.event_id = e.id
                         AND r.user_id NOT IN (SELECT id FROM users WHERE role = 'teacher')
LEFT JOIN evaluations ev ON ev.registration_id = r.id
LEFT JOIN event_evaluation_answers eea ON eea.evaluation_id = ev.id AND eea.score IS NOT NULL
WHERE e.is_listed = 1 AND e.status = 'done'
GROUP BY YEAR(e.date_start) + (MONTH(e.date_start) >= 10) + 543, e.category;

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
--   ('วรันธร สอนสงวน',         'warunthorn_s@silpakorn.edu', '$2y$10$REPLACE_WITH_REAL_HASH', 'organizer', 'นักวิชาการอุดมศึกษาปฏิบัติการ'),
--   ('ภัทร ยะคำวุฒิ',          'phat_y@silpakorn.edu',    '$2y$10$REPLACE_WITH_REAL_HASH', 'student',   'นักศึกษาชั้นปีที่ 3 · วิทยาการคอมพิวเตอร์');
