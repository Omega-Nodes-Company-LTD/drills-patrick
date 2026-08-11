-- Public transparency: readings over time, impact indicators with a stated
-- method, spending by category, and the before/after figures a community
-- actually feels (walk and queue) alongside the ones a funder reads.

CREATE TABLE "impact_indicator_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indicator_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"methodology" text,
	CONSTRAINT "impact_indicator_translations_key" UNIQUE("indicator_id","locale")
);
--> statement-breakpoint
CREATE TABLE "impact_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"unit" text,
	"methodology" text DEFAULT '' NOT NULL,
	"source" text,
	"verified_on" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "impact_indicators_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "spending_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"category" text NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spending_entry_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	CONSTRAINT "spending_entry_translations_key" UNIQUE("entry_id","locale")
);
--> statement-breakpoint
CREATE TABLE "water_point_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"measured_on" date NOT NULL,
	"yield_liters_per_hour" integer,
	"static_level_m" integer,
	"note" text,
	"measured_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "pre_walk_minutes" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "post_walk_minutes" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "pre_queue_minutes" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "post_queue_minutes" integer;--> statement-breakpoint
ALTER TABLE "impact_indicator_translations" ADD CONSTRAINT "impact_indicator_translations_indicator_id_impact_indicators_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."impact_indicators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spending_entry_translations" ADD CONSTRAINT "spending_entry_translations_entry_id_spending_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."spending_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_point_readings" ADD CONSTRAINT "water_point_readings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "impact_indicators_order_idx" ON "impact_indicators" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "spending_entries_year_idx" ON "spending_entries" USING btree ("year","sort_order");--> statement-breakpoint
CREATE INDEX "water_point_readings_project_idx" ON "water_point_readings" USING btree ("project_id","measured_on");