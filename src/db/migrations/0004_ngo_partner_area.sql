-- Partner-facing tables: accounts, documents, quotes, maintenance, faults and
-- signatures. Generated from the schema, then trimmed: drizzle re-emitted the
-- hand-written 0002 and 0003 migrations because its snapshot predates them.

CREATE TYPE "public"."document_kind" AS ENUM('water_quality', 'drilling_log', 'handover', 'commissioning', 'contract', 'report', 'other');--> statement-breakpoint
CREATE TYPE "public"."fault_status" AS ENUM('reported', 'acknowledged', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."maintenance_visit_kind" AS ENUM('scheduled', 'repair', 'inspection', 'training');--> statement-breakpoint
CREATE TABLE "contract_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	CONSTRAINT "contract_projects_key" UNIQUE("contract_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "document_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"signer_role" text,
	"signer_organisation" text,
	"signature_image" text NOT NULL,
	"content_hash" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drilling_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"depth_from_m" integer DEFAULT 0 NOT NULL,
	"depth_to_m" integer DEFAULT 1000 NOT NULL,
	"geology" text DEFAULT 'any' NOT NULL,
	"rate_per_metre_minor" bigint DEFAULT 0 NOT NULL,
	"fixed_cost_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fault_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"reporter_name" text,
	"reporter_phone" text,
	"description" text NOT NULL,
	"symptom" text,
	"status" "fault_status" DEFAULT 'reported' NOT NULL,
	"photo_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fault_reports_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "maintenance_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"visit_interval_months" integer DEFAULT 6 NOT NULL,
	"fee_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"response_hours" integer DEFAULT 72 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"contract_id" uuid,
	"fault_report_id" uuid,
	"kind" "maintenance_visit_kind" DEFAULT 'scheduled' NOT NULL,
	"visited_on" date NOT NULL,
	"technician" text,
	"findings" text,
	"work_done" text,
	"parts_used" text,
	"cost_minor" bigint,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"functional_after" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ngo_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"phone" text,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"report_frequency" text DEFAULT 'none' NOT NULL,
	"last_report_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ngo_contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "partner_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"relationship" text DEFAULT 'funder' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_projects_key" UNIQUE("partner_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "project_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"media_id" uuid,
	"kind" "document_kind" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"issued_on" date,
	"expires_on" date,
	"is_public" boolean DEFAULT false NOT NULL,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"partner_id" uuid,
	"inquiry_id" uuid,
	"organisation_name" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"district" text,
	"geology" text DEFAULT 'any' NOT NULL,
	"depth_m" integer DEFAULT 60 NOT NULL,
	"wells_count" integer DEFAULT 1 NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'UGX' NOT NULL,
	"valid_until" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "site_settings" ALTER COLUMN "organisation" SET DEFAULT '{"registryUrls":[]}'::jsonb;--> statement-breakpoint
ALTER TABLE "contract_projects" ADD CONSTRAINT "contract_projects_contract_id_maintenance_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."maintenance_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_projects" ADD CONSTRAINT "contract_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_document_id_project_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fault_reports" ADD CONSTRAINT "fault_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fault_reports" ADD CONSTRAINT "fault_reports_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_contracts" ADD CONSTRAINT "maintenance_contracts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_visits" ADD CONSTRAINT "maintenance_visits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_visits" ADD CONSTRAINT "maintenance_visits_contract_id_maintenance_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."maintenance_contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ngo_contacts" ADD CONSTRAINT "ngo_contacts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_projects" ADD CONSTRAINT "partner_projects_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_projects" ADD CONSTRAINT "partner_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_signatures_document_idx" ON "document_signatures" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "drilling_rates_active_idx" ON "drilling_rates" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "fault_reports_project_idx" ON "fault_reports" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "fault_reports_status_idx" ON "fault_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "maintenance_contracts_partner_idx" ON "maintenance_contracts" USING btree ("partner_id","is_active");--> statement-breakpoint
CREATE INDEX "maintenance_visits_project_idx" ON "maintenance_visits" USING btree ("project_id","visited_on");--> statement-breakpoint
CREATE INDEX "ngo_contacts_partner_idx" ON "ngo_contacts" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "project_documents_project_idx" ON "project_documents" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "project_documents_public_idx" ON "project_documents" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "quotes_partner_idx" ON "quotes" USING btree ("partner_id","status");
