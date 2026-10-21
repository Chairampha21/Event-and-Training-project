-- Link each event's coordinator (organizer_name, chosen by name) to the
-- teacher account with that name, so the teacher can follow the event's
-- report. Run once on existing databases.
ALTER TABLE events
  ADD COLUMN coordinator_id INT UNSIGNED NULL AFTER organizer_name,
  ADD KEY idx_events_coordinator (coordinator_id),
  ADD CONSTRAINT fk_events_coordinator FOREIGN KEY (coordinator_id) REFERENCES users(id) ON DELETE SET NULL;

UPDATE events e
JOIN users u ON u.role = 'teacher' AND (
  e.organizer_name = u.name OR e.organizer_name = CASE
    WHEN COALESCE(u.title_th, '') = '' THEN u.name
    WHEN u.title_th LIKE '%.' OR u.title_th IN ('นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง') THEN CONCAT(u.title_th, u.name)
    ELSE CONCAT(u.title_th, ' ', u.name) END)
SET e.coordinator_id = u.id
WHERE e.coordinator_id IS NULL;
