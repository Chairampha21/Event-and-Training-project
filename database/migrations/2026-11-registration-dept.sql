-- Keep each registrant's year and major (users.dept) as it was when they
-- registered, so an event's report doesn't change when a student later moves
-- up a year or changes major. Run once on databases created before this change.
--
-- Registrations already made have no such record; they are filled in from the
-- profile as it is now, which is the best that is known.
ALTER TABLE registrations ADD COLUMN dept VARCHAR(190) NULL AFTER attend_via;
UPDATE registrations r JOIN users u ON u.id = r.user_id SET r.dept = u.dept WHERE r.dept IS NULL;
