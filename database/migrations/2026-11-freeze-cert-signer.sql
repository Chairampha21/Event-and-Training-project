-- Events whose certificates are already open keep the signer they have now,
-- so changing the department default (a new head of department in a new
-- academic year) never changes certificates already handed out. Events that
-- named no signer of their own take today's default. Run once.
UPDATE events e JOIN cert_defaults d ON d.id = 1
SET e.cert_signature_url = d.signature_url
WHERE e.cycle_stage >= 4 AND COALESCE(e.cert_signer_name, '') = '' AND COALESCE(e.cert_signature_url, '') = '';

UPDATE events e JOIN cert_defaults d ON d.id = 1
SET e.cert_signer_name = COALESCE(NULLIF(e.cert_signer_name, ''), d.signer_name),
    e.cert_signer_title = COALESCE(NULLIF(e.cert_signer_title, ''), d.signer_title)
WHERE e.cycle_stage >= 4 AND (COALESCE(e.cert_signer_name, '') = '' OR COALESCE(e.cert_signer_title, '') = '');
