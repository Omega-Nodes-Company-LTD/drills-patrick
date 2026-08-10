-- Trigram indexes for the keyword pass of the hybrid search.
--
-- `keywordSearch` filters with `ILIKE '%term%'` and ranks with `similarity()`.
-- A leading wildcard makes a btree index useless, so without these every
-- search read every translation row of every entity — and the translation
-- tables grow with five languages per item.
--
-- GIN with `gin_trgm_ops` answers the ILIKE directly, which is what drives
-- the scan; similarity() then ranks only the rows the index returned.
-- Verified on PostgreSQL 16: at 65k translation rows the planner switches
-- from a sequential scan to a bitmap index scan on these.

CREATE INDEX IF NOT EXISTS "post_translations_title_trgm_idx" ON "post_translations" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_translations_excerpt_trgm_idx" ON "post_translations" USING gin ("excerpt" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_translations_content_trgm_idx" ON "post_translations" USING gin ("content_html" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "project_translations_title_trgm_idx" ON "project_translations" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_translations_summary_trgm_idx" ON "project_translations" USING gin ("summary" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_translations_content_trgm_idx" ON "project_translations" USING gin ("content_html" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "campaign_translations_title_trgm_idx" ON "campaign_translations" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_translations_summary_trgm_idx" ON "campaign_translations" USING gin ("summary" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_translations_content_trgm_idx" ON "campaign_translations" USING gin ("content_html" gin_trgm_ops);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "page_translations_title_trgm_idx" ON "page_translations" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faq_translations_question_trgm_idx" ON "faq_translations" USING gin ("question" gin_trgm_ops);
