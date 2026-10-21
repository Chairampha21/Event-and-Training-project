-- Teacher accounts of the Department of Computing (role 'teacher').
-- Each can follow the reports of the events they coordinate. Re-running it
-- only refreshes names and titles; it never changes a password or role.
-- Every new account starts with the password Passw0rd! — change it before
-- real use. Emails follow surname_initial@silpakorn.edu: check them.
SET NAMES utf8mb4;

-- The demo account first made as paansri_b takes the right spelling.
UPDATE users SET email = 'pansri_b@silpakorn.edu' WHERE email = 'paansri_b@silpakorn.edu'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM users WHERE email = 'pansri_b@silpakorn.edu') x);

INSERT INTO users (title_th, name, title_en, name_en, email, password_hash, role, dept, active, email_verified_at) VALUES
  ('ผศ.ดร.', 'สิรักข์ แก้วจำนงค์', 'Asst. Prof. Dr.', 'Sirak Kaewjamnong', 'kaewjamnong_s@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'หัวหน้าภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.', 'โอภาส วงษ์ทวีทรัพย์', 'Asst. Prof.', 'Opas Wongtaweesap', 'wongtaweesap_o@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('อ.ดร.', 'ภูริวัจน์ วรวิชัยพัฒน์', 'Dr.', 'Phuriwat Worrawichaipat', 'worawichaipat_p@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('รศ.ดร.', 'ปานใจ ธารทัศนวงศ์', 'Assoc. Prof. Dr.', 'Panjai Tantatsanawong', 'tantatsanawong_p@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'กรัญญา สิทธิสงวน', 'Asst. Prof. Dr.', 'Karanya Sitdhisanguan', 'sitdhisanguan_k@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'กฤษณะ สีพนมวัน', 'Asst. Prof. Dr.', 'Kristsana Seepanomwan', 'seepanomwan_k@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'คทา ประดิษฐวงศ์', 'Asst. Prof. Dr.', 'Kata Praditwong', 'praditwong_k@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'ณัฐโชติ พรหมฤทธิ์', 'Asst. Prof. Dr.', 'Nuttachot Promrit', 'promrit_n@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'ทัศนวรรณ ศูนย์กลาง', 'Asst. Prof. Dr.', 'Tasanawan Soonklang', 'soonklang_t@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'ปัญญนัท อ้นพงษ์', 'Asst. Prof. Dr.', 'Panyanat Aonpong', 'aonpong_p@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'รัชดาพร คณาวงษ์', 'Asst. Prof. Dr.', 'Ratchadaporn Kanawong', 'kanawong_r@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'วีณาวดี ม่วงอ้น', 'Asst. Prof. Dr.', 'Weenawadee Muangon', 'muangon_w@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'สัจจาภรณ์ ไวจรรยา', 'Asst. Prof. Dr.', 'Sajjaporn Waijanya', 'waijanya_s@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'สุนีย์ พงษ์พินิจภิญโญ', 'Asst. Prof. Dr.', 'Sunee Pongpinigpinyo', 'pongpinigpinyo_s@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('ผศ.ดร.', 'อรวรรณ เชาวลิต', 'Asst. Prof. Dr.', 'Orawan Chaowalit', 'chaowalit_o@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('อ.ดร.', 'ณัฐพงศ์ จิวมั่งมี', 'Dr.', 'Nattapong Jewmungme', 'jewmungme_n@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('อ.ดร.', 'บูชาภัทร ป้านศรี', 'Dr.', 'Buchaputara Pansri', 'pansri_b@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('อ.ดร.', 'วัสรา รอดเหตุภัย', 'Dr.', 'Wasara Rodhetbhai', 'rodhetbhai_w@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('อ.ดร.', 'เสาวลักษณ์ อร่ามพงศานุวัต', 'Dr.', 'Saowalak Arampongsanuwat', 'arampongsanuwat_s@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('อ.ดร.', 'เสฐลัทธ์ รอดเหตุภัย', 'Dr.', 'Sethalat Rodhetbhai', 'rodhetbhai_s@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP()),
  ('อ.', 'อภิเษก หงษ์วิทยากร', NULL, 'Apisake Hongwitayakorn', 'hongwitayakorn_a@silpakorn.edu', '$2a$10$Cynp0lxKUuHSODqnhQgKM.3/uWI8ka9kxYW5Cg9m5GWbfur9GaK9y', 'teacher', 'อาจารย์ประจำภาควิชาคอมพิวเตอร์', 1, UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE title_th = VALUES(title_th), name = VALUES(name), title_en = VALUES(title_en), name_en = VALUES(name_en);

-- Staff who are not teachers: their English names only.
UPDATE users SET title_en = 'Miss', name_en = 'Waranthorn Sonsa-nguan' WHERE email = 'sonsanguan_w@silpakorn.edu';

-- Link events already naming one of them as coordinator.
UPDATE events e
JOIN users u ON u.role = 'teacher' AND e.organizer_name = CONCAT(u.title_th, u.name)
SET e.coordinator_id = u.id
WHERE e.coordinator_id IS NULL;
