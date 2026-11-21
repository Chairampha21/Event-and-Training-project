-- Personal details users may add on their profile: nickname, phone, blood
-- type, food allergies, medical conditions and an emergency contact.
-- Run once on databases created before this change.
ALTER TABLE users
  ADD COLUMN nickname          VARCHAR(50)  NULL AFTER dept,
  ADD COLUMN phone             VARCHAR(20)  NULL AFTER nickname,
  ADD COLUMN blood_type        ENUM('A','B','AB','O') NULL AFTER phone,
  ADD COLUMN food_allergy      VARCHAR(255) NULL AFTER blood_type,
  ADD COLUMN medical_note      VARCHAR(255) NULL AFTER food_allergy,
  ADD COLUMN emergency_contact VARCHAR(150) NULL AFTER medical_note;
