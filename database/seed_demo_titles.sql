-- Titles for the demo accounts (seed.sql, demo_organizer.sql), so they can
-- register for events (registering needs a title and a Thai name for the
-- certificate). Matched by email; an account that already has a title is
-- left as it is, so re-running it changes nothing.
SET NAMES utf8mb4;

UPDATE users SET title_th = 'ผศ.ดร.', title_en = 'Asst. Prof. Dr.' WHERE email = 'piya_c@silpakorn.edu' AND (title_th IS NULL OR title_th = '');
UPDATE users SET title_th = 'นางสาว', title_en = 'Miss' WHERE email = 'sonsanguan_w@silpakorn.edu' AND (title_th IS NULL OR title_th = '');

UPDATE users SET title_th = 'นาย', title_en = 'Mr.'
WHERE role = 'student' AND (title_th IS NULL OR title_th = '') AND email IN (
  'apiwit_t@silpakorn.edu',
  'boonruang_w@silpakorn.edu',
  'chanathip_b@silpakorn.edu',
  'jaingam_s@silpakorn.edu',
  'kasemsuk_a@silpakorn.edu',
  'khayanying_n@silpakorn.edu',
  'kittipat_j@silpakorn.edu',
  'meesuk_t@silpakorn.edu',
  'natthawut_s@silpakorn.edu',
  'nontakorn_s@silpakorn.edu',
  'pawarit_j@silpakorn.edu',
  'phat_y@silpakorn.edu',
  'phumipat_r@silpakorn.edu',
  'ratchanon_t@silpakorn.edu',
  'siwakorn_p@silpakorn.edu',
  'teeraphat_p@silpakorn.edu',
  'thanakrit_w@silpakorn.edu',
  'thongkham_k@silpakorn.edu',
  'voramet_s@silpakorn.edu'
);

UPDATE users SET title_th = 'นางสาว', title_en = 'Miss'
WHERE role = 'student' AND (title_th IS NULL OR title_th = '') AND email IN (
  'benyapa_k@silpakorn.edu',
  'duangdee_n@silpakorn.edu',
  'kanyarat_t@silpakorn.edu',
  'manatsanan_c@silpakorn.edu',
  'nichapat_s@silpakorn.edu',
  'onpreeya_s@silpakorn.edu',
  'pimchanok_k@silpakorn.edu',
  'pitchayapa_n@silpakorn.edu',
  'promsuwan_c@silpakorn.edu',
  'punyaporn_w@silpakorn.edu',
  'rakrian_s@silpakorn.edu',
  'saengchan_w@silpakorn.edu',
  'sirinda_m@silpakorn.edu',
  'srisawat_p@silpakorn.edu',
  'supisara_i@silpakorn.edu',
  'yanisa_p@silpakorn.edu'
);

-- demo_organizer.sql's students: odd numbers are men, even numbers women.
UPDATE users SET title_th = 'นาย', title_en = 'Mr.'
WHERE role = 'student' AND (title_th IS NULL OR title_th = '') AND email IN (
  'demo.student01@silpakorn.edu',
  'demo.student03@silpakorn.edu',
  'demo.student05@silpakorn.edu',
  'demo.student07@silpakorn.edu',
  'demo.student09@silpakorn.edu',
  'demo.student11@silpakorn.edu',
  'demo.student13@silpakorn.edu',
  'demo.student15@silpakorn.edu',
  'demo.student17@silpakorn.edu',
  'demo.student19@silpakorn.edu',
  'demo.student21@silpakorn.edu',
  'demo.student23@silpakorn.edu',
  'demo.student25@silpakorn.edu',
  'demo.student27@silpakorn.edu',
  'demo.student29@silpakorn.edu'
);

UPDATE users SET title_th = 'นางสาว', title_en = 'Miss'
WHERE role = 'student' AND (title_th IS NULL OR title_th = '') AND email IN (
  'demo.student02@silpakorn.edu',
  'demo.student04@silpakorn.edu',
  'demo.student06@silpakorn.edu',
  'demo.student08@silpakorn.edu',
  'demo.student10@silpakorn.edu',
  'demo.student12@silpakorn.edu',
  'demo.student14@silpakorn.edu',
  'demo.student16@silpakorn.edu',
  'demo.student18@silpakorn.edu',
  'demo.student20@silpakorn.edu',
  'demo.student22@silpakorn.edu',
  'demo.student24@silpakorn.edu',
  'demo.student26@silpakorn.edu',
  'demo.student28@silpakorn.edu',
  'demo.student30@silpakorn.edu'
);
