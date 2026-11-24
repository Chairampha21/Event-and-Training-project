-- =====================================================================
-- Demo: every student who attended a finished (closed) event has answered
-- its evaluation and so received its certificate — as the system does it:
-- submitting the evaluation issues the certificate at that moment.
--
-- Finished events: 1002, 1004, 1006, 1011, 1013 (demo_organizer, the first
-- three closed by seed_fy2569_moves), 1014, 1015 (seed_blacklist),
-- 1051 (seed_sound_sport), 1053 (seed_next_step), 1054 (seed_cv_ai_industry),
-- 1055 (seed_llm_rag), 1056 (seed_ntt_roadshow), 1057–1059 (seed_web_dev_aws),
-- 1060–1062 (seed_skill_up_more).
--   * Events that didn't give certificates now do, with the department's
--     default signer kept on them (as opening certificates does).
--   * Events without an evaluation form get one in the demo's usual shape:
--     gender, programme, rating statements, one multiple-choice question.
--   * Answers: gender follows the name title, programme the registration;
--     ratings mostly 4–5; choices spread over the options.
--   * Certificate codes SU-CS-2569-401 … (room up to 899) in the order the
--     evaluations came in; the demo's own are 901–925, and the system's
--     next free number is found by counting, so neither collides.
--
-- Apply LAST (after every other seed). Safe to run again: it first removes
-- its own rows (questions 900200–900399, evaluations with id ≥ 50000000,
-- certificates SU-CS-2569-400…899) and puts those registrations back to
-- 'attended'.
--   docker exec -i cpsu-etms-mysql mysql --default-character-set=utf8mb4 -uroot cpsu_etms < database/seed_certificates.sql
-- =====================================================================

USE cpsu_etms;
SET NAMES utf8mb4;

SET @events := '1002,1004,1006,1011,1013,1014,1015,1051,1053,1054,1055,1056,1057,1058,1059,1060,1061,1062';

-- ------------------------------------------------------------------ undo an earlier run
DELETE FROM certificates WHERE cert_code REGEXP '^SU-CS-2569-[4-8][0-9][0-9]$';
DELETE FROM evaluations WHERE id >= 50000000;                       -- answers cascade
DELETE FROM event_evaluation_questions WHERE id BETWEEN 900200 AND 900399;
UPDATE registrations r SET r.status = 'attended'
WHERE r.status = 'certified' AND FIND_IN_SET(r.event_id, @events)
  AND NOT EXISTS (SELECT 1 FROM certificates c WHERE c.registration_id = r.id);

-- ------------------------------------------------------------------ certificates on, signer kept
UPDATE events SET issue_certificate = 1 WHERE FIND_IN_SET(id, @events);
-- The department default when one is set, else the signer the other demo
-- events carry.
UPDATE events e LEFT JOIN cert_defaults d ON d.id = 1
SET e.cert_signer_name   = COALESCE(NULLIF(e.cert_signer_name, ''), NULLIF(d.signer_name, ''), 'ผศ.ดร. ปิยะ จันทรัศมี'),
    e.cert_signer_title  = COALESCE(NULLIF(e.cert_signer_title, ''), NULLIF(d.signer_title, ''), 'หัวหน้าภาควิชาคอมพิวเตอร์'),
    e.cert_signature_url = COALESCE(NULLIF(e.cert_signature_url, ''), d.signature_url)
WHERE FIND_IN_SET(e.id, @events);

-- ------------------------------------------------------------------ evaluation forms for events that had none
SET @g  := 'เพศ';
SET @go := '["ชาย", "หญิง", "ไม่ประสงค์ระบุเพศ"]';
SET @p  := 'สาขาวิชา';
SET @po := '["สาขาวิชาวิทยาการคอมพิวเตอร์", "สาขาวิชาเทคโนโลยีสารสนเทศ"]';
SET @s1 := 'นักศึกษามีความรู้ความเข้าใจในรายวิชามากขึ้น สามารถวิเคราะห์ปัญหาและพัฒนาโปรแกรมคอมพิวเตอร์ตามความต้องการของผู้ใช้ได้';
SET @s2 := 'นักศึกษาสามารถนำความรู้ที่ได้จากโครงการไปปรับใช้ในรายวิชาอื่น ๆ ที่เกี่ยวข้องต่อไปได้';
SET @s3 := 'นักศึกษาได้รับความรู้ แนวทางในการเรียน สามารถนำความรู้ที่ได้ไปประยุกต์ในการเรียนการสอนต่อไปได้';

INSERT INTO event_evaluation_questions (id, event_id, label, sort_order, question_type, options, required) VALUES
  -- 1014 Git & GitHub
  (900201, 1014, @g, 1, 'choice', @go, 1), (900202, 1014, @p, 2, 'choice', @po, 1),
  (900203, 1014, @s1, 3, 'scale', NULL, 1), (900204, 1014, @s2, 4, 'scale', NULL, 1), (900205, 1014, @s3, 5, 'scale', NULL, 1),
  (900206, 1014, 'สามารถใช้ Git และ GitHub ทำงานร่วมกับผู้อื่นในโครงงานได้', 6, 'scale', NULL, 1),
  (900207, 1014, 'อยากให้จัดหัวข้อต่อยอดเรื่องใดมากที่สุด', 7, 'choice', '["GitHub Actions (CI/CD)", "Git Flow สำหรับการทำงานเป็นทีม", "Code Review บน GitHub"]', 1),
  -- 1015 Cybersecurity
  (900211, 1015, @g, 1, 'choice', @go, 1), (900212, 1015, @p, 2, 'choice', @po, 1),
  (900213, 1015, @s1, 3, 'scale', NULL, 1), (900214, 1015, @s2, 4, 'scale', NULL, 1), (900215, 1015, @s3, 5, 'scale', NULL, 1),
  (900216, 1015, 'ตระหนักถึงภัยไซเบอร์และรู้วิธีป้องกันตนเองมากขึ้น', 6, 'scale', NULL, 1),
  (900217, 1015, 'อยากให้จัดหัวข้อต่อยอดเรื่องใดมากที่สุด', 7, 'choice', '["การตั้งรหัสผ่านและการยืนยันตัวตนสองขั้นตอน", "การสังเกตอีเมลและลิงก์ฟิชชิง", "ความปลอดภัยของ Wi-Fi สาธารณะ"]', 1),
  -- 1051 Sound & Sport for Wellbeing (recreation: its own statements)
  (900221, 1051, @g, 1, 'choice', @go, 1), (900222, 1051, @p, 2, 'choice', @po, 1),
  (900223, 1051, 'กิจกรรมช่วยให้ผ่อนคลายความเครียดและมีสุขภาพกายใจที่ดีขึ้น', 3, 'scale', NULL, 1),
  (900224, 1051, 'ได้สร้างความสัมพันธ์กับเพื่อน รุ่นพี่ รุ่นน้อง และคณาจารย์ในภาควิชา', 4, 'scale', NULL, 1),
  (900225, 1051, 'รูปแบบกิจกรรม สถานที่ และระยะเวลามีความเหมาะสม', 5, 'scale', NULL, 1),
  (900226, 1051, 'อยากให้จัดกิจกรรมลักษณะนี้อีกในปีถัดไป', 6, 'scale', NULL, 1),
  (900227, 1051, 'กิจกรรมที่ชอบมากที่สุด', 7, 'choice', '["ดนตรี", "ปิงปอง", "กีฬาอื่น ๆ"]', 1),
  -- 1053 Next Step CPSU 69
  (900231, 1053, @g, 1, 'choice', @go, 1), (900232, 1053, @p, 2, 'choice', @po, 1),
  (900233, 1053, @s3, 3, 'scale', NULL, 1),
  (900234, 1053, 'เข้าใจข้อกำหนดและขั้นตอนของรายวิชาเตรียมโปรเจค / โปรเจค และสหกิจศึกษามากขึ้น', 4, 'scale', NULL, 1),
  (900235, 1053, 'สามารถวางแผนการเรียนให้สำเร็จการศึกษาตามหลักสูตรได้', 5, 'scale', NULL, 1),
  (900236, 1053, 'ได้รับคำแนะนำเกี่ยวกับปัญหาและอุปสรรคในการเรียนที่เป็นประโยชน์', 6, 'scale', NULL, 1),
  (900237, 1053, 'เส้นทางที่สนใจในชั้นปีที่ 4', 7, 'choice', '["สหกิจศึกษา", "โครงงานวิจัย", "ทุนศึกษา / ฝึกปฏิบัติการในต่างประเทศ"]', 1),
  -- 1054 Computer Vision Applications & AI in Industry
  (900241, 1054, @g, 1, 'choice', @go, 1), (900242, 1054, @p, 2, 'choice', @po, 1),
  (900243, 1054, @s1, 3, 'scale', NULL, 1), (900244, 1054, @s2, 4, 'scale', NULL, 1), (900245, 1054, @s3, 5, 'scale', NULL, 1),
  (900246, 1054, 'เข้าใจการนำ Computer Vision และ AI ไปใช้ในงานอุตสาหกรรมจริงมากขึ้น', 6, 'scale', NULL, 1),
  (900247, 1054, 'อยากให้จัดหัวข้อต่อยอดเรื่องใดมากที่สุด', 7, 'choice', '["Defect Detection เชิงปฏิบัติการ", "Edge AI", "MLOps / การนำโมเดลขึ้นใช้งานจริง"]', 1),
  -- 1055 LLMs, Agentic AI and RAG
  (900251, 1055, @g, 1, 'choice', @go, 1), (900252, 1055, @p, 2, 'choice', @po, 1),
  (900253, 1055, @s1, 3, 'scale', NULL, 1), (900254, 1055, @s2, 4, 'scale', NULL, 1), (900255, 1055, @s3, 5, 'scale', NULL, 1),
  (900256, 1055, 'สามารถนำ LLMs และ RAG ไปประยุกต์ใช้ในการพัฒนาซอฟต์แวร์หรือโครงงานได้', 6, 'scale', NULL, 1),
  (900257, 1055, 'อยากให้จัดหัวข้อต่อยอดเรื่องใดมากที่สุด', 7, 'choice', '["การสร้าง AI Agent", "RAG กับข้อมูลขององค์กร", "การใช้ AI ช่วยเขียนและทดสอบโค้ด"]', 1),
  -- 1056 NTT DATA Digital Innovation Challenge 2026 Roadshow
  (900261, 1056, @g, 1, 'choice', @go, 1), (900262, 1056, @p, 2, 'choice', @po, 1),
  (900263, 1056, @s2, 3, 'scale', NULL, 1), (900264, 1056, @s3, 4, 'scale', NULL, 1),
  (900265, 1056, 'เข้าใจแนวทางการประยุกต์ใช้ Agentic AI กับการทำงานและธุรกิจจริงมากขึ้น', 5, 'scale', NULL, 1),
  (900266, 1056, 'ได้รับข้อมูลเกี่ยวกับโครงการ Digital Innovation Challenge 2026 ครบถ้วนชัดเจน', 6, 'scale', NULL, 1),
  (900267, 1056, 'สนใจสมัครแข่งขัน Digital Innovation Challenge 2026 หรือไม่', 7, 'choice', '["สนใจและจะสมัคร", "สนใจแต่ยังไม่แน่ใจ", "ยังไม่สนใจ"]', 1),
  -- 1057 Web Developer ด้วย Next.js
  (900271, 1057, @g, 1, 'choice', @go, 1), (900272, 1057, @p, 2, 'choice', @po, 1),
  (900273, 1057, @s1, 3, 'scale', NULL, 1), (900274, 1057, @s2, 4, 'scale', NULL, 1), (900275, 1057, @s3, 5, 'scale', NULL, 1),
  (900276, 1057, 'สามารถสร้างเว็บไซต์พื้นฐานด้วย Next.js และ React ได้ด้วยตนเอง', 6, 'scale', NULL, 1),
  (900277, 1057, 'อยากให้จัดหัวข้อต่อยอดเรื่องใดมากที่สุด', 7, 'choice', '["การเชื่อมต่อฐานข้อมูลและ API", "การ Deploy เว็บขึ้นใช้งานจริง", "การทำระบบสมาชิกและการยืนยันตัวตน"]', 1),
  -- 1058 Web Developer ด้วย Ruby on Rails
  (900281, 1058, @g, 1, 'choice', @go, 1), (900282, 1058, @p, 2, 'choice', @po, 1),
  (900283, 1058, @s1, 3, 'scale', NULL, 1), (900284, 1058, @s2, 4, 'scale', NULL, 1), (900285, 1058, @s3, 5, 'scale', NULL, 1),
  (900286, 1058, 'เข้าใจโครงสร้างโปรเจกต์ Ruby on Rails และสามารถสร้างเว็บไซต์พื้นฐานได้', 6, 'scale', NULL, 1),
  (900287, 1058, 'อยากให้จัดหัวข้อต่อยอดเรื่องใดมากที่สุด', 7, 'choice', '["Rails API ร่วมกับ React", "การทดสอบระบบ (Testing)", "การ Deploy เว็บขึ้นใช้งานจริง"]', 1),
  -- 1059 AWS Academy & Tech Alliance Workshop 2026
  (900291, 1059, @g, 1, 'choice', @go, 1), (900292, 1059, @p, 2, 'choice', @po, 1),
  (900293, 1059, @s2, 3, 'scale', NULL, 1), (900294, 1059, @s3, 4, 'scale', NULL, 1),
  (900295, 1059, 'สามารถสร้าง AI Application แบบ No-Code ด้วย AWS PartyRock ได้', 5, 'scale', NULL, 1),
  (900296, 1059, 'เข้าใจพื้นฐานด้าน Cloud และ Machine Learning มากขึ้น', 6, 'scale', NULL, 1),
  (900297, 1059, 'ใบรับรองหรือหัวข้อที่อยากเรียนรู้ต่อ', 7, 'choice', '["AWS Cloud Practitioner", "AWS Machine Learning", "Generative AI บน AWS"]', 1),
  -- 1060 AI Vibe Coding for Web & Mobile Application Development
  (900301, 1060, @g, 1, 'choice', @go, 1), (900302, 1060, @p, 2, 'choice', @po, 1),
  (900303, 1060, @s1, 3, 'scale', NULL, 1), (900304, 1060, @s2, 4, 'scale', NULL, 1), (900305, 1060, @s3, 5, 'scale', NULL, 1),
  (900306, 1060, 'สามารถใช้ AI เป็น Coding Partner ในการพัฒนา Web และ Mobile Application ได้', 6, 'scale', NULL, 1),
  (900307, 1060, 'เครื่องมือที่อยากเรียนรู้เพิ่มเติม', 7, 'choice', '["Cursor / AI Code Editor", "Flutter ร่วมกับ AI", "การเขียน Prompt สำหรับงานพัฒนาระบบ"]', 1),
  -- 1061 Upskill/Reskill: digital skills and AI for work (topics 4-5)
  (900311, 1061, @g, 1, 'choice', @go, 1), (900312, 1061, @p, 2, 'choice', @po, 1),
  (900313, 1061, 'มีความรู้ความเข้าใจด้านความมั่นคงปลอดภัยไซเบอร์ กฎหมายคอมพิวเตอร์ และ PDPA มากขึ้น', 3, 'scale', NULL, 1),
  (900314, 1061, 'สามารถใช้ Canva และ CapCut สร้างสื่อดิจิทัลสำหรับการทำงานได้', 4, 'scale', NULL, 1),
  (900315, 1061, 'สามารถนำความรู้ไปประยุกต์ใช้ในการเรียนหรือการทำงานได้', 5, 'scale', NULL, 1),
  (900316, 1061, 'รูปแบบการอบรม (Onsite / Online) และระยะเวลามีความเหมาะสม', 6, 'scale', NULL, 1),
  (900317, 1061, 'หัวข้อที่เป็นประโยชน์ที่สุด', 7, 'choice', '["Cyber Security และ PDPA", "Canva for Work", "CapCut และ AI ตัดต่อวิดีโอ"]', 1),
  -- 1062 Future Learning Explorer (study visit)
  (900321, 1062, @g, 1, 'choice', @go, 1), (900322, 1062, @p, 2, 'choice', @po, 1),
  (900323, 1062, 'ได้เปิดมุมมองการประยุกต์ใช้เทคโนโลยีดิจิทัลในการจัดนิทรรศการและการสื่อสารองค์ความรู้', 3, 'scale', NULL, 1),
  (900324, 1062, 'สามารถนำแนวคิดที่ได้ไปใช้ในการจัดงานสัปดาห์วันวิทยาศาสตร์ได้', 4, 'scale', NULL, 1),
  (900325, 1062, 'การเดินทาง กำหนดการ และการดูแลระหว่างกิจกรรมมีความเหมาะสม', 5, 'scale', NULL, 1),
  (900326, 1062, 'อยากให้จัดกิจกรรมศึกษาดูงานลักษณะนี้อีก', 6, 'scale', NULL, 1),
  (900327, 1062, 'สถานที่ที่ชอบมากที่สุด', 7, 'choice', '["พิพิธภัณฑ์เทคโนโลยีสารสนเทศ", "พิพิธภัณฑ์ฟิวเจอเรียม", "ศูนย์การเรียนรู้ กฟผ.", "หอภาพยนตร์"]', 1);

-- ------------------------------------------------------------------ evaluations: every student who attended and hasn't answered yet
INSERT INTO evaluations (id, registration_id, submitted_at)
SELECT r.id + 50000000, r.id,
       TIMESTAMP(e.date_start + INTERVAL (1 + r.id % 4) DAY, SEC_TO_TIME((9 + r.id % 12) * 3600 + (r.id % 50) * 60))
FROM registrations r JOIN events e ON e.id = r.event_id JOIN users u ON u.id = r.user_id
WHERE FIND_IN_SET(e.id, @events) AND r.status = 'attended' AND u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM evaluations v WHERE v.registration_id = r.id);

INSERT INTO event_evaluation_answers (evaluation_id, question_id, score, answer_text)
SELECT v.id, q.id,
       IF(q.question_type = 'scale',
          CASE (v.registration_id * 7 + q.id * 3) % 10 WHEN 0 THEN 3 WHEN 1 THEN 4 WHEN 2 THEN 4 WHEN 3 THEN 4 WHEN 4 THEN 4 ELSE 5 END,
          NULL),
       IF(q.question_type = 'choice',
          CASE
            WHEN q.label = 'เพศ' THEN CASE u.title_th WHEN 'นาย' THEN 'ชาย' WHEN 'นางสาว' THEN 'หญิง' ELSE 'ไม่ประสงค์ระบุเพศ' END
            WHEN q.label = 'สาขาวิชา' THEN IF(COALESCE(r.dept, u.dept) LIKE '%สารสนเทศ%', 'สาขาวิชาเทคโนโลยีสารสนเทศ', 'สาขาวิชาวิทยาการคอมพิวเตอร์')
            ELSE JSON_UNQUOTE(JSON_EXTRACT(q.options, CONCAT('$[', (v.registration_id + q.id) % JSON_LENGTH(q.options), ']')))
          END,
          NULL)
FROM evaluations v
JOIN registrations r ON r.id = v.registration_id
JOIN users u ON u.id = r.user_id
JOIN event_evaluation_questions q ON q.event_id = r.event_id
WHERE v.id >= 50000000;

-- ------------------------------------------------------------------ certificates, issued as each evaluation came in
INSERT INTO certificates (registration_id, cert_code, default_template_id, issued_at)
SELECT x.registration_id, CONCAT('SU-CS-2569-', 400 + x.n), (SELECT template_id FROM cert_defaults WHERE id = 1), x.submitted_at
FROM (SELECT v.registration_id, v.submitted_at, ROW_NUMBER() OVER (ORDER BY v.submitted_at, v.registration_id) AS n
      FROM evaluations v WHERE v.id >= 50000000) x;

UPDATE registrations r JOIN certificates c ON c.registration_id = r.id
SET r.status = 'certified'
WHERE c.cert_code REGEXP '^SU-CS-2569-[4-8][0-9][0-9]$';

-- Told that certificates were open (the morning after the event), so the
-- reminder job has nothing left to send about them.
UPDATE registrations r JOIN events e ON e.id = r.event_id
SET r.cert_notified_at = TIMESTAMP(e.date_start + INTERVAL 1 DAY, '09:00:00')
WHERE FIND_IN_SET(e.id, @events) AND r.status IN ('attended', 'certified') AND r.cert_notified_at IS NULL;
