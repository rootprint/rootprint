-- Custom SQL migration file, put your code below! --

-- Before this release the message field was a hardcoded trailing column and was
-- never stored in display_fields. It is now a regular column, so append each
-- index's message field to any saved preference that doesn't already list it,
-- otherwise existing users lose their message column. Rows with NULL
-- display_fields keep the client-side default (message only) and are untouched.
-- Indexes with no index_settings row fall back to 'body.message', the same
-- default getIndexSettings() serves, so their prefs get backfilled too.
WITH resolved AS (
	SELECT up."id" AS id,
	       up."display_fields" AS display_fields,
	       COALESCE(s."message_field", 'body.message') AS message_field
	FROM "user_preference" up
	LEFT JOIN "index_settings" s ON s."index_id" = up."index_id"
	WHERE up."display_fields" IS NOT NULL
)
UPDATE "user_preference" up
SET "display_fields" = r.display_fields || to_jsonb(r.message_field)
FROM resolved r
WHERE up."id" = r.id
  AND NOT (r.display_fields ? r.message_field);

-- Saved views store their column list the same way and have the same regression.
-- Views with NULL columns mean "leave current columns" on apply, so skip those.
WITH resolved AS (
	SELECT v."id" AS id,
	       v."columns" AS columns,
	       COALESCE(s."message_field", 'body.message') AS message_field
	FROM "view" v
	LEFT JOIN "index_settings" s ON s."index_id" = v."index_id"
	WHERE v."columns" IS NOT NULL
)
UPDATE "view" v
SET "columns" = r.columns || to_jsonb(r.message_field)
FROM resolved r
WHERE v."id" = r.id
  AND NOT (r.columns ? r.message_field);
