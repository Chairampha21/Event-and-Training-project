-- =====================================================================
-- CPSU ETMS — sample / demo dataset for database/schema.sql
--
-- Realistic sample rows mirroring the frontend's mock data
-- (frontend/src/data/eventsData.js, rostersData.js, evalQuestions.js,
-- pages/admin/BlacklistPage.jsx) so the schema can be tested end-to-end
-- with data that matches what's shown in the UI.
--
-- Apply AFTER schema.sql:
--   mysql -u root -p cpsu_etms < database/schema.sql
--   mysql -u root -p cpsu_etms < database/seed.sql
--
-- All demo accounts share the password "demo1234" (bcrypt hash below,
-- verified to match — swap in real hashes for anything beyond local dev).
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
-- users (password for all: demo1234)
-- ---------------------------------------------------------------------
INSERT INTO users (id, name, email, password_hash, role, student_id, dept, active) VALUES
  (1, 'ผศ.ดร. ปิยะ จันทรัศมี', 'piya_c@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'admin', NULL, 'หัวหน้าภาควิชาคอมพิวเตอร์', 1),
  (2, 'วรันธร สอนสงวน', 'krisada_p@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'organizer', NULL, 'อาจารย์ผู้ดูแลกิจกรรม', 1),
  (3, 'อ. พิชญาภร วงศ์เขื่อน', 'pitchaporn_w@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'organizer', NULL, 'อาจารย์ผู้ดูแลกิจกรรม', 1),
  (4, 'ภัทร ยะคำวุฒิ', 'phat_y@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '64xxxxx21', 'นักศึกษาชั้นปีที่ 3 · วท.บ. คอมพิวเตอร์', 1),
  (5, 'พันธิตา แก้วสุข', 'panthita_k@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '65xxxxx14', 'นักศึกษาชั้นปีที่ 2', 1),
  (6, 'ธนวัฒน์ ทองอำนวย', 'thanawat_t@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '64xxxxx07', 'นักศึกษาชั้นปีที่ 4', 0),
  (7, 'กชกร เจริญสุข', 'kotchakon_j@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '65xxxxx32', 'นักศึกษาชั้นปีที่ 2', 1),
  (8, 'ธีรภัทร วิชัยกุล', 'theerapat_w@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '64xxxxx01', 'นักศึกษาชั้นปีที่ 3', 1),
  (9, 'วรรณวิภา ชัยมี', 'wanwipha_c@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '64xxxxx55', 'นักศึกษาชั้นปีที่ 3', 1),
  (10, 'จักรพล พิพัฒน์สุวรรณ', 'jakkrapol_p@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '63xxxxx08', 'นักศึกษาชั้นปีที่ 4', 1),
  (11, 'อนุชา ควงตี', 'anucha_k@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '65xxxxx91', 'นักศึกษาชั้นปีที่ 2', 1),
  (12, 'วรพจน์ ตั้งเจริญดี', 'worapot_t@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '63xxxxx76', 'นักศึกษาชั้นปีที่ 4', 1),
  (13, 'สิริกานต์ พรหมนันทร์', 'sirikan_p@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '64xxxxx39', 'นักศึกษาชั้นปีที่ 3', 1),
  (14, 'จัยวัฒน์ พุ่มมาศ', 'jaiwat_p@silpakorn.edu', '$2b$12$dIQVLDR2C63UO3vusokyauUabrJDfqG6mB.5K0PcmB192KYNp8.mG', 'student', '62xxxxx48', 'นักศึกษาชั้นปีที่ 4', 1);

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
INSERT INTO events (id, title, category, subcategory, organizer_id, organizer_name, day_mode, date_start, date_end, time_range, attend_mode, place, online_link, capacity, status, cycle_stage, is_listed, description, cert_signer_name, cert_signer_title) VALUES
  (1, 'Python for Data Science: จาก Zero สู่ Pandas & Visualization', 'Workshop', 'Programming', NULL, 'ผศ.ดร. ธนภณ รักษ์ควร', 'multi', '2025-06-28', '2025-06-29', '09:00–16:00 น.', 'onsite', 'ห้อง 4503 อาคารวิทยาศาสตร์ 4', NULL, 60, 'open', 1, 1, 'เวิร์กช็อป 2 วัน ปูพื้นฐาน NumPy, Pandas และ Matplotlib จากชุดข้อมูลจริง ฝึกทำความสะอาดข้อมูลและนำเสนอผลลัพธ์เป็นกราฟ เหมาะสำหรับนักศึกษาชั้นปีที่ 1–2 ที่ยังไม่เคยเขียน Python มาก่อน', 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (2, 'Generative AI in Production', 'สัมมนา', 'AI / Data', 2, 'วรันธร สอนสงวน', 'single', '2025-07-12', NULL, '13:00–17:00 น.', 'onsite', 'หอประชุมคณะวิทยาศาสตร์', NULL, 200, 'soon', 0, 1, 'สัมมนาเจาะลึกการนำโมเดล Generative AI ขึ้นใช้งานจริงระดับ production ครอบคลุม prompt engineering, การ deploy และความปลอดภัย', 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (3, 'Ethical Hacking 101', 'Workshop', 'Cybersecurity', NULL, 'อ.ดร. ธวีตา สุขสวัสดิ์', 'multi', '2025-08-05', '2025-08-07', 'เต็มวัน', 'onsite', 'ห้องปฏิบัติการ 4612', NULL, 40, 'full', 2, 1, 'เวิร์กช็อป 3 วัน เรียนรู้การเจาะระบบเชิงจริยธรรม การประเมินช่องโหว่ และการป้องกัน พร้อม lab จริงบนระบบจำลอง', 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (4, 'Flutter Starter Camp: From Widget to App Store', 'Workshop', 'Mobile', 3, 'อ. พิชญาภร วงศ์เขื่อน', 'single', '2025-08-20', NULL, '09:00–17:00 น.', 'onsite', 'ห้องคอมพิวเตอร์ 4602', NULL, 35, 'open', 1, 1, 'ค่ายปฏิบัติการ 1 วัน สร้างแอป Flutter ตัวแรกตั้งแต่ widget พื้นฐานจนถึงการเตรียมขึ้น store', 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (5, 'SU-CS Hackathon 2025', 'การแข่งขัน', 'Hackathon', NULL, 'ชมรมกิจกรรมวิชาการ SU-CS', 'multi', '2025-09-08', '2025-09-10', '36 ชั่วโมง', 'onsite', 'Innovation Hub', NULL, 20, 'open', 1, 1, 'การแข่งขันพัฒนาต้นแบบซอฟต์แวร์ 36 ชั่วโมงแบบทีม ชิงเงินรางวัลและโอกาสฝึกงาน', 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (6, 'SQL Bootcamp สำหรับนักวิเคราะห์ข้อมูล', 'Workshop', 'Data', 2, 'วรันธร สอนสงวน', 'multi', '2025-09-15', '2025-09-16', '09:00–16:00 น.', 'onsite', 'ห้อง 4503', NULL, 45, 'done', 3, 1, 'เวิร์กช็อปการเขียน SQL เชิงวิเคราะห์ ตั้งแต่ JOIN พื้นฐานจนถึง window function', 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (7, 'CS Career Day 2025', 'สัมมนา', 'Career', NULL, 'ฝ่ายกิจการนักศึกษา', 'single', '2025-09-25', NULL, '13:00–18:00 น.', 'onsite', 'หอประชุมใหญ่', NULL, 300, 'open', 1, 1, 'งานเปิดโอกาสสายอาชีพ IT ร่วมกับบริษัทชั้นนำและศิษย์เก่า พร้อมเวิร์กช็อปเขียนเรซูเม่', 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (8, 'Foundations of Deep Learning', 'สัมมนา', 'AI', NULL, 'ศ.ดร. อนงค์ ปวงคำ', 'single', '2025-05-28', NULL, '09:00–12:00 น.', 'onsite', 'หอประชุมคณะวิทยาศาสตร์', NULL, 250, 'done', 3, 0, NULL, 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (9, 'CS Alumni Talk: เส้นทางสู่สาย Software Engineer', 'สัมมนา', 'Career', NULL, 'ชมรมศิษย์เก่า', 'single', '2025-03-12', NULL, 'ออนไลน์ · Zoom', 'online', 'ออนไลน์', NULL, 400, 'done', 3, 0, NULL, 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (10, 'Intro to Web Security: OWASP Top 10', 'Workshop', 'Cybersecurity', NULL, 'อ.ดร. ธวีตา สุขสวัสดิ์', 'single', '2025-04-22', NULL, '13:00–16:00 น.', 'onsite', 'ห้องปฏิบัติการ 4612', NULL, 40, 'done', 3, 0, NULL, 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์'),
  (11, 'AI Vibe Coding for Web & Mobile Application Development', 'Workshop', 'AI / Coding', NULL, 'ภาควิชาคอมพิวเตอร์ (CPSU) · คณะวิทยาศาสตร์', 'multi', '2026-05-08', '2026-05-09', '08:30–16:30 น.', 'onsite', 'ห้อง 1227 ชั้น 2 อาคารวิทยาศาสตร์ 1', NULL, 100, 'open', 1, 1, 'ใช้ AI เป็น Coding Partner ตรงจุดตั้งแต่ต้นจนจบ — แนวคิด AI Vibe Coding / AI-Assisted Development · พัฒนา Web & Mobile App (Flutter + AI) · สร้าง Web Application (Frontend + Backend) · เทคนิคการเขียน Prompt ให้ AI สร้างโค้ดได้ตรงจุด · ออกแบบระบบ (System Design + Data Flow) · ทำ Mini Project จาก Prototype สู่ Product · รับใบเกียรติบัตรจากอาจารย์ประจำภาควิชาคอมพิวเตอร์ 100 คน', 'ผศ.ดร.สิรักข์ แก้วจำนงค์', 'หัวหน้าภาควิชาคอมพิวเตอร์');

-- ---------------------------------------------------------------------
-- registrations (event roster + check-in state)
-- ---------------------------------------------------------------------
INSERT INTO registrations (event_id, user_id, status, checked_in) VALUES
  (1, 4, 'registered', 0),
  (1, 7, 'registered', 0),
  (1, 8, 'registered', 0),
  (1, 9, 'registered', 0),
  (1, 10, 'registered', 0),
  (1, 11, 'registered', 0),
  (1, 12, 'registered', 0),
  (1, 13, 'registered', 0),
  (3, 4, 'attended', 1),
  (3, 11, 'registered', 0),
  (3, 12, 'attended', 1),
  (3, 13, 'attended', 1),
  (3, 14, 'registered', 0),
  (3, 5, 'attended', 1),
  (3, 6, 'attended', 1),
  (3, 7, 'registered', 0),
  (4, 13, 'registered', 0),
  (4, 14, 'registered', 0),
  (4, 5, 'registered', 0),
  (4, 6, 'registered', 0),
  (4, 7, 'registered', 0),
  (4, 8, 'registered', 0),
  (4, 9, 'registered', 0),
  (4, 10, 'registered', 0),
  (5, 4, 'registered', 0),
  (5, 5, 'registered', 0),
  (5, 6, 'registered', 0),
  (5, 7, 'registered', 0),
  (5, 8, 'registered', 0),
  (5, 9, 'registered', 0),
  (5, 10, 'registered', 0),
  (5, 11, 'registered', 0),
  (6, 4, 'certified', 1),
  (6, 7, 'certified', 1),
  (6, 8, 'attended', 1),
  (6, 9, 'certified', 1),
  (6, 10, 'attended', 1),
  (6, 11, 'certified', 1),
  (6, 12, 'absent', 0),
  (6, 13, 'certified', 1),
  (7, 9, 'registered', 0),
  (7, 10, 'registered', 0),
  (7, 11, 'registered', 0),
  (7, 12, 'registered', 0),
  (7, 13, 'registered', 0),
  (7, 14, 'registered', 0),
  (7, 5, 'registered', 0),
  (7, 6, 'registered', 0),
  (8, 4, 'certified', 1),
  (8, 11, 'certified', 1),
  (8, 12, 'attended', 1),
  (8, 13, 'certified', 1),
  (8, 14, 'attended', 1),
  (8, 5, 'certified', 1),
  (8, 6, 'absent', 0),
  (8, 7, 'certified', 1),
  (9, 4, 'certified', 1),
  (9, 13, 'certified', 1),
  (9, 14, 'attended', 1),
  (9, 5, 'certified', 1),
  (9, 6, 'attended', 1),
  (9, 7, 'certified', 1),
  (9, 8, 'absent', 0),
  (9, 9, 'certified', 1),
  (10, 4, 'absent', 0),
  (10, 5, 'certified', 1),
  (10, 6, 'attended', 1),
  (10, 7, 'certified', 1),
  (10, 8, 'attended', 1),
  (10, 9, 'certified', 1),
  (10, 10, 'absent', 0),
  (10, 11, 'certified', 1),
  (11, 7, 'registered', 0),
  (11, 8, 'registered', 0),
  (11, 9, 'registered', 0),
  (11, 10, 'registered', 0),
  (11, 11, 'registered', 0),
  (11, 12, 'registered', 0),
  (11, 13, 'registered', 0),
  (11, 14, 'registered', 0);

-- ---------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------
INSERT INTO certificates (registration_id, cert_code, issued_at)
SELECT r.id, c.cert_code, c.issued_at FROM registrations r
JOIN (
  SELECT 6 AS event_id, 4 AS user_id, 'SU-CS-2568-018' AS cert_code, '2025-09-17 10:00:00' AS issued_at
  UNION ALL SELECT 6, 7, 'SU-CS-2568-019', '2025-09-17 10:00:00'
  UNION ALL SELECT 6, 9, 'SU-CS-2568-020', '2025-09-17 10:00:00'
  UNION ALL SELECT 6, 11, 'SU-CS-2568-021', '2025-09-17 10:00:00'
  UNION ALL SELECT 6, 13, 'SU-CS-2568-022', '2025-09-17 10:00:00'
  UNION ALL SELECT 8, 4, 'SU-CS-2568-023', '2025-09-17 10:00:00'
  UNION ALL SELECT 8, 11, 'SU-CS-2568-024', '2025-09-17 10:00:00'
  UNION ALL SELECT 8, 13, 'SU-CS-2568-025', '2025-09-17 10:00:00'
  UNION ALL SELECT 8, 5, 'SU-CS-2568-026', '2025-09-17 10:00:00'
  UNION ALL SELECT 8, 7, 'SU-CS-2568-027', '2025-09-17 10:00:00'
  UNION ALL SELECT 9, 4, 'SU-CS-2568-028', '2025-09-17 10:00:00'
  UNION ALL SELECT 9, 13, 'SU-CS-2568-029', '2025-09-17 10:00:00'
  UNION ALL SELECT 9, 5, 'SU-CS-2568-030', '2025-09-17 10:00:00'
  UNION ALL SELECT 9, 7, 'SU-CS-2568-031', '2025-09-17 10:00:00'
  UNION ALL SELECT 9, 9, 'SU-CS-2568-032', '2025-09-17 10:00:00'
  UNION ALL SELECT 10, 5, 'SU-CS-2568-033', '2025-09-17 10:00:00'
  UNION ALL SELECT 10, 7, 'SU-CS-2568-034', '2025-09-17 10:00:00'
  UNION ALL SELECT 10, 9, 'SU-CS-2568-035', '2025-09-17 10:00:00'
  UNION ALL SELECT 10, 11, 'SU-CS-2568-036', '2025-09-17 10:00:00'
) AS c ON r.event_id = c.event_id AND r.user_id = c.user_id;

-- ---------------------------------------------------------------------
-- evaluations (post-event survey, required before certification)
-- ---------------------------------------------------------------------
INSERT INTO evaluations (registration_id)
SELECT r.id FROM registrations r WHERE r.status = 'certified';

INSERT INTO evaluation_answers (evaluation_id, question_id, score)
SELECT ev.id, q.id, 4 + ((ev.id + q.id) % 2)
FROM evaluations ev CROSS JOIN evaluation_questions q;

-- ---------------------------------------------------------------------
-- sar_reports
-- ---------------------------------------------------------------------
INSERT INTO sar_reports (event_id, report_code, purpose, outcome, gaps, improvement, status, created_by) VALUES
  (6, 'SAR-2568-006', '1) เพื่อให้นักศึกษานำความรู้ไปประยุกต์ใช้ในโครงงาน
2) เพื่อยกระดับทักษะปฏิบัติให้ทันความต้องการของตลาดแรงงาน
3) เพื่อสร้างเครือข่ายความร่วมมือระหว่างนักศึกษาต่างชั้นปี', 'ผู้เข้าร่วมส่วนใหญ่สามารถนำความรู้ไปประยุกต์ใช้ได้จริง และให้คะแนนความพึงพอใจในระดับดีถึงดีมาก', 'พบว่าผู้เข้าร่วมบางส่วนยังขาดพื้นฐานที่จำเป็นก่อนเข้าร่วม ทำให้ตามเนื้อหาบางช่วงไม่ทัน ควรเพิ่มเอกสารเตรียมความพร้อมล่วงหน้า', '1) จัดทำ pre-workshop checklist ให้ผู้เข้าร่วมเตรียมเครื่องมือล่วงหน้า
2) แบ่งกลุ่มตามระดับพื้นฐานเพื่อให้เนื้อหาตรงกลุ่มเป้าหมายมากขึ้น
3) เพิ่มแบบฝึกหัดระหว่าง session เพื่อวัดความเข้าใจ', 'draft', 2);

-- ---------------------------------------------------------------------
-- blacklist_entries
-- ---------------------------------------------------------------------
INSERT INTO blacklist_entries (user_id, name, email, student_id, reason, created_by, created_at) VALUES
  (6, 'ธนวัฒน์ ทองอำนวย', 'thanawat_t@silpakorn.edu', '64xxxxx07', 'ขาดกิจกรรม 3 ครั้งติดกันโดยไม่แจ้งล่วงหน้า', 1, '2025-07-02 09:00:00'),
  (7, 'น.ส. กชกร เจริญสุข', 'kotchakon_j@silpakorn.edu', '65xxxxx32', 'เช็คอินแทนผู้อื่นในกิจกรรม SQL Bootcamp', 2, '2025-07-17 09:00:00');

-- ---------------------------------------------------------------------
-- activity_logs
-- ---------------------------------------------------------------------
INSERT INTO activity_logs (user_id, action, detail, created_at) VALUES
  (1, 'UPDATE', 'แก้ไขกิจกรรม "Python for Data Science: จาก Zero สู่ Pandas & Visualization"', '2025-05-20 14:32:11'),
  (2, 'CREATE', 'สร้างกิจกรรมใหม่ "Flutter Starter Camp: From Widget to App Store"', '2025-05-20 14:18:42'),
  (4, 'REGISTER', 'ลงทะเบียนกิจกรรม "SU-CS Hackathon 2025"', '2025-05-20 13:58:09'),
  (NULL, 'EMAIL', 'ส่งอีเมลเตือนล่วงหน้ากิจกรรม "Ethical Hacking 101" ให้ผู้สมัคร', '2025-05-20 13:42:01'),
  (1, 'BLACKLIST', 'เพิ่ม "ธนวัฒน์ ทองอำนวย" เข้า Blacklist · เหตุผล: ขาดกิจกรรมต่อเนื่อง', '2025-07-02 09:05:00'),
  (2, 'ISSUE', 'เปิดสิทธิ์เกียรติบัตร "SQL Bootcamp สำหรับนักวิเคราะห์ข้อมูล" (39 คน)', '2025-09-17 09:48:30'),
  (4, 'CHECKIN', 'เช็คอินเข้าร่วมกิจกรรม "Ethical Hacking 101" ด้วย QR', '2025-08-05 09:10:00'),
  (2, 'BLACKLIST', 'เพิ่ม "น.ส. กชกร เจริญสุข" เข้า Blacklist · เหตุผล: เช็คอินแทนผู้อื่น', '2025-07-17 09:05:00');

-- ---------------------------------------------------------------------
-- notifications (demo student inbox)
-- ---------------------------------------------------------------------
INSERT INTO notifications (user_id, icon, tone, title, message, is_read, created_at) VALUES
  (4, 'ti-certificate', 'accent', 'เกียรติบัตรของคุณพร้อมแล้ว', 'SQL Bootcamp สำหรับนักวิเคราะห์ข้อมูล · รหัสตรวจสอบ SU-CS-2568-018', 0, '2025-09-17 02:00:00'),
  (4, 'ti-user-check', 'accent', 'อนุมัติทีมเข้าร่วมแล้ว', 'SU-CS Hackathon 2025 · ทีม Pandas in Pajamas', 0, '2025-09-06 08:00:00'),
  (4, 'ti-sparkles', 'dark', 'กิจกรรมใหม่เปิดรับสมัคร', 'Generative AI in Production · 12 ก.ค.', 0, '2025-07-03 08:00:00'),
  (4, 'ti-speakerphone', NULL, 'ประกาศผลคัดเลือก', 'SU-CS Hackathon 2025 · 14 ทีมที่ผ่าน', 1, '2025-09-08 08:00:00');
