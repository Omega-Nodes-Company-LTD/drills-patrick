-- History of slugs an entity used to live at.
--
-- Renaming a project or an article is an ordinary editorial act, and until
-- now it silently broke every link to the old URL — inbound links from
-- partners, printed QR codes, a donor's bookmark. Keeping the old slug lets
-- the detail routes answer with a redirect instead of a 404, which also
-- preserves whatever authority the old URL had accumulated.
--
-- No foreign key on entity_id: the four content types live in four tables and
-- one nullable column per table would be worse. Rows are cleaned up when the
-- entity is deleted, in the same action that deletes it.

CREATE TABLE IF NOT EXISTS "slug_redirects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "locale" "locale" NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "slug_redirects_type_locale_slug_key" UNIQUE("entity_type","locale","slug")
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "slug_redirects_entity_idx" ON "slug_redirects" USING btree ("entity_type","entity_id");
