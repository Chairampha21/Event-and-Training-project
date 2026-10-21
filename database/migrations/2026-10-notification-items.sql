-- Summary notifications (the admin digest, an organizer's post-event tasks)
-- list their parts, each with its own link. Run once on existing databases.
ALTER TABLE notifications ADD COLUMN items JSON NULL AFTER link;
