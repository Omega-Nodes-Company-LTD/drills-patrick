CREATE TYPE "public"."fundraiser_status" AS ENUM('pending', 'approved', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "public"."legacy_enquiry_kind" AS ENUM('legacy', 'major_gift', 'foundation', 'in_memory');--> statement-breakpoint
CREATE TYPE "public"."legacy_enquiry_status" AS ENUM('new', 'in_conversation', 'closed');--> statement-breakpoint
CREATE TYPE "public"."recurring_interval" AS ENUM('monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TABLE "campaign_milestone_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	CONSTRAINT "campaign_milestone_translations_key" UNIQUE("milestone_id","locale")
);
--> statement-breakpoint
CREATE TABLE "campaign_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"threshold_minor" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporate_sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo_id" uuid,
	"website_url" text,
	"project_id" uuid,
	"campaign_id" uuid,
	"donation_id" uuid,
	"tier" text,
	"contact_name" text,
	"contact_email" text,
	"legal_name" text,
	"vat_number" text,
	"address_lines" text[] DEFAULT '{}' NOT NULL,
	"country" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fundraiser_donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fundraiser_id" uuid NOT NULL,
	"donation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fundraiser_donations_donation_key" UNIQUE("donation_id")
);
--> statement-breakpoint
CREATE TABLE "fundraisers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"owner_name" text NOT NULL,
	"owner_email" text NOT NULL,
	"title" text NOT NULL,
	"story" text DEFAULT '' NOT NULL,
	"cover_id" uuid,
	"campaign_id" uuid,
	"project_id" uuid,
	"goal_amount_minor" bigint DEFAULT 0 NOT NULL,
	"raised_amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"status" "fundraiser_status" DEFAULT 'pending' NOT NULL,
	"moderation_note" text,
	"manage_token_hash" text NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fundraisers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donation_id" uuid NOT NULL,
	"sender_name" text NOT NULL,
	"sender_email" text,
	"recipient_name" text NOT NULL,
	"recipient_email" text,
	"message" text DEFAULT '' NOT NULL,
	"design_id" uuid,
	"occasion" text,
	"deliver_on" date,
	"sent_at" timestamp with time zone,
	"view_token_hash" text NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"series" text NOT NULL,
	"sequence" integer NOT NULL,
	"year" integer NOT NULL,
	"donation_id" uuid,
	"sponsor_id" uuid,
	"issued_on" date NOT NULL,
	"bill_to_name" text NOT NULL,
	"bill_to_vat" text,
	"bill_to_address" text DEFAULT '' NOT NULL,
	"bill_to_country" text,
	"description" text DEFAULT '' NOT NULL,
	"net_minor" bigint NOT NULL,
	"tax_rate_bp" integer DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"gross_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"tax_note" text,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_series_sequence_key" UNIQUE("series","year","sequence")
);
--> statement-breakpoint
CREATE TABLE "legacy_enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "legacy_enquiry_kind" DEFAULT 'legacy' NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"country" text,
	"organisation" text,
	"message" text DEFAULT '' NOT NULL,
	"preferred_contact" text,
	"status" "legacy_enquiry_status" DEFAULT 'new' NOT NULL,
	"admin_note" text,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matching_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pledge_id" uuid NOT NULL,
	"donation_id" uuid NOT NULL,
	"matched_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matching_allocations_donation_key" UNIQUE("donation_id")
);
--> statement-breakpoint
CREATE TABLE "matching_pledges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"matcher_name" text NOT NULL,
	"matcher_logo_id" uuid,
	"matcher_url" text,
	"ratio_bp" integer DEFAULT 10000 NOT NULL,
	"ceiling_minor" bigint NOT NULL,
	"per_donation_cap_minor" bigint,
	"matched_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"donation_id" uuid NOT NULL,
	"charged_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_charges_donation_key" UNIQUE("donation_id")
);
--> statement-breakpoint
CREATE TABLE "recurring_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"donor_name" text,
	"donor_email" text NOT NULL,
	"campaign_id" uuid,
	"project_id" uuid,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"interval" "recurring_interval" DEFAULT 'monthly' NOT NULL,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"next_charge_on" date,
	"paused_until" date,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"manage_token_hash" text NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_plans_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "well_adoptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"donation_id" uuid,
	"donor_name" text NOT NULL,
	"donor_email" text NOT NULL,
	"donor_organisation" text,
	"started_on" date NOT NULL,
	"ends_on" date,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"update_every_months" integer DEFAULT 3 NOT NULL,
	"last_update_sent_at" timestamp with time zone,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "invoicing" jsonb;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "show_on_wall" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "wall_display_name" text;--> statement-breakpoint
ALTER TABLE "campaign_milestone_translations" ADD CONSTRAINT "campaign_milestone_translations_milestone_id_campaign_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."campaign_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_milestones" ADD CONSTRAINT "campaign_milestones_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_sponsors" ADD CONSTRAINT "corporate_sponsors_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_sponsors" ADD CONSTRAINT "corporate_sponsors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_sponsors" ADD CONSTRAINT "corporate_sponsors_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_sponsors" ADD CONSTRAINT "corporate_sponsors_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundraiser_donations" ADD CONSTRAINT "fundraiser_donations_fundraiser_id_fundraisers_id_fk" FOREIGN KEY ("fundraiser_id") REFERENCES "public"."fundraisers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundraiser_donations" ADD CONSTRAINT "fundraiser_donations_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_design_id_media_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sponsor_id_corporate_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."corporate_sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_allocations" ADD CONSTRAINT "matching_allocations_pledge_id_matching_pledges_id_fk" FOREIGN KEY ("pledge_id") REFERENCES "public"."matching_pledges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_allocations" ADD CONSTRAINT "matching_allocations_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_pledges" ADD CONSTRAINT "matching_pledges_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_pledges" ADD CONSTRAINT "matching_pledges_matcher_logo_id_media_id_fk" FOREIGN KEY ("matcher_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_plan_id_recurring_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."recurring_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_charges" ADD CONSTRAINT "recurring_charges_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_plans" ADD CONSTRAINT "recurring_plans_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_plans" ADD CONSTRAINT "recurring_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_adoptions" ADD CONSTRAINT "well_adoptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_adoptions" ADD CONSTRAINT "well_adoptions_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_milestones_campaign_idx" ON "campaign_milestones" USING btree ("campaign_id","threshold_minor");--> statement-breakpoint
CREATE INDEX "corporate_sponsors_project_idx" ON "corporate_sponsors" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "corporate_sponsors_published_idx" ON "corporate_sponsors" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "fundraiser_donations_fundraiser_idx" ON "fundraiser_donations" USING btree ("fundraiser_id");--> statement-breakpoint
CREATE INDEX "fundraisers_status_idx" ON "fundraisers" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "fundraisers_email_idx" ON "fundraisers" USING btree ("owner_email");--> statement-breakpoint
CREATE INDEX "gift_cards_delivery_idx" ON "gift_cards" USING btree ("sent_at","deliver_on");--> statement-breakpoint
CREATE INDEX "gift_cards_donation_idx" ON "gift_cards" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX "invoices_issued_idx" ON "invoices" USING btree ("issued_on");--> statement-breakpoint
CREATE INDEX "legacy_enquiries_status_idx" ON "legacy_enquiries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "matching_allocations_pledge_idx" ON "matching_allocations" USING btree ("pledge_id");--> statement-breakpoint
CREATE INDEX "matching_pledges_window_idx" ON "matching_pledges" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "recurring_charges_plan_idx" ON "recurring_charges" USING btree ("plan_id","charged_on");--> statement-breakpoint
CREATE INDEX "recurring_plans_status_idx" ON "recurring_plans" USING btree ("status","next_charge_on");--> statement-breakpoint
CREATE INDEX "recurring_plans_email_idx" ON "recurring_plans" USING btree ("donor_email");--> statement-breakpoint
CREATE INDEX "well_adoptions_project_idx" ON "well_adoptions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "well_adoptions_active_idx" ON "well_adoptions" USING btree ("is_active","last_update_sent_at");