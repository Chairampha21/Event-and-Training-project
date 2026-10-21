-- The admin can fit the certificate text to the built-in template too; that
-- placement is kept on the defaults row. Run once on existing databases.
ALTER TABLE cert_defaults ADD COLUMN layout TEXT NULL AFTER template_id;
