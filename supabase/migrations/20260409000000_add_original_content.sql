-- Preserve AI-generated content separately from user edits.
-- When a user edits a draft before publishing, the original AI output
-- is kept here for quality analysis (edit rate tracking).
alter table posts add column if not exists original_content text;

-- Backfill: for existing posts, original_content = current content
update posts set original_content = content where original_content is null;
