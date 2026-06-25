-- Custom SQL migration file, put your code below! --

-- Before this release the message field was a hardcoded trailing column and was
-- never stored in display_fields. It is now a regular column, so append each
-- index's message field to any saved preference that doesn't already list it,
-- otherwise existing users lose their message column. Rows with NULL
-- display_fields keep the client-side default (message only) and are untouched.
UPDATE "user_preference" up
SET "display_fields" = up."display_fields" || to_jsonb(s."message_field")
FROM "index_settings" s
WHERE up."index_id" = s."index_id"
  AND up."display_fields" IS NOT NULL
  AND NOT (up."display_fields" ? s."message_field");

-- Saved views store their column list the same way and have the same regression.
-- Views with NULL columns mean "leave current columns" on apply, so skip those.
UPDATE "view" v
SET "columns" = v."columns" || to_jsonb(s."message_field")
FROM "index_settings" s
WHERE v."index_id" = s."index_id"
  AND v."columns" IS NOT NULL
  AND NOT (v."columns" ? s."message_field");