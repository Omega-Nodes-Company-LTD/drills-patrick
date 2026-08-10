-- Attributed authorship for technical content.
--
-- A drilling log or a water-quality report is only worth as much as the
-- person who signed it. `posts.author_member_id` lets an article be credited
-- to a team member with a public profile — qualifications, role, photo,
-- LinkedIn — rather than only to the admin account that happened to save it.
--
-- `credentials` is free text, entered by the operator: "MSc Hydrogeology,
-- Makerere University". Nothing is inferred.

ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "credentials" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "author_member_id" uuid;--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "posts"
    ADD CONSTRAINT "posts_author_member_id_team_members_id_fk"
    FOREIGN KEY ("author_member_id") REFERENCES "team_members"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "posts_author_member_idx" ON "posts" USING btree ("author_member_id");
