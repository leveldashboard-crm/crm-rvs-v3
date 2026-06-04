-- ═══════════════════════════════════════════════════════════════════════════════
-- DelegateConnect CRM — Supabase PostgreSQL Schema v5.0.0
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. UTILITY FUNCTIONS & TRIGGERS FOR TIMESTAMPS
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'staff' NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

DROP TRIGGER IF EXISTS set_timestamp_users ON "users";
CREATE TRIGGER set_timestamp_users
  BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 3. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS "registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"sr_no" integer,
	"timestamp_raw" text,
	"title" text,
	"first_name" text,
	"last_name" text,
	"country_name" text,
	"passport_country" text,
	"region" text,
	"participant_mobile" text,
	"participant_email" text,
	"company_name" text,
	"company_website" text,
	"designation" text,
	"passport_number" text,
	"place_of_issue" text,
	"date_of_expiry" text,
	"passport_front_copy" text,
	"passport_back_copy" text,
	"nature_of_business" text,
	"main_import_product_1" text,
	"main_import_product_2" text,
	"proof_upload" text,
	"products_services" text,
	"business_card_upload" text,
	"poc" text,
	"proof_import" text,
	"type_of_poi" text,
	"bl_supplier_country" text,
	"bl_buyer_country" text,
	"status" text,
	"flight_hotel_code" text,
	"remarks" text,
	"bl_status" text,
	"bb_invitation_status" text,
	"dollar_business" text,
	"vujis" text,
	"will_not_attend" text,
	"is_active" boolean DEFAULT true,
	"drive_passport_front_url" text,
	"drive_passport_back_url" text,
	"drive_proof_url" text,
	"drive_business_card_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_sr_no_unique" UNIQUE("sr_no")
);

DROP TRIGGER IF EXISTS set_timestamp_registrations ON "registrations";
CREATE TRIGGER set_timestamp_registrations
  BEFORE UPDATE ON "registrations"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 4. TRAVEL RECORDS TABLE
CREATE TABLE IF NOT EXISTS "travel_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"registration_id" integer,
	"responses_sr_no" text,
	"room_no" text,
	"hotel_name" text,
	"initial" text,
	"first_name" text,
	"last_name" text,
	"country_name" text,
	"country_code" text,
	"participant_mobile" text,
	"check_in_date" date,
	"check_out_date" date,
	"room_units" numeric(4, 2),
	"arrival_date" date,
	"arrival_flight_no" text,
	"arrival_to" text,
	"arrival_time" time,
	"departure_date" date,
	"departure_flight_no" text,
	"departure_from" text,
	"departure_time" time,
	"sector" text,
	"company_name" text,
	"poc" text,
	"status" text DEFAULT 'Pending',
	"reimbursement" text DEFAULT 'No',
	"notes" text,
	"invoice_amount" text,
	"invoice_amount_usd" text,
	"invoice_amount_local" text,
	"invoice_currency" text,
	"ticket_received" text DEFAULT 'No',
	"invoice_received" text DEFAULT 'No',
	"visa_received" text DEFAULT 'No',
	"passport_copy_received" text DEFAULT 'No',
	"voucher_received" text DEFAULT 'No',
	"reimbursement_amount" text,
	"bl" text,
	"bl_url" text,
	"ticket_url" text,
	"invoice_url" text,
	"visa_url" text,
	"passport_url" text,
	"voucher_url" text,
	"business_card_url" text,
	"ticket_drive_id" text,
	"invoice_drive_id" text,
	"visa_drive_id" text,
	"passport_drive_id" text,
	"voucher_drive_id" text,
	"business_card_drive_id" text,
	"bl_drive_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_travel_records ON "travel_records";
CREATE TRIGGER set_timestamp_travel_records
  BEFORE UPDATE ON "travel_records"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 5. DB & VUJIS RECORDS TABLE
CREATE TABLE IF NOT EXISTS "db_vujis_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"sr_no" integer,
	"company_name" text,
	"country_name" text,
	"region" text,
	"proof_of_import_y" text,
	"proof_of_import_n" text,
	"vujis" text,
	"import_value_vujis" text,
	"dollar_business" text,
	"import_value_dollar" text,
	"both_db_vujis" text,
	"importing_from_india" text,
	"importing_from_other_country" text,
	"main_import_product_1" text,
	"main_import_product_2" text,
	"poc" text,
	"reason" text,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "db_vujis_records_sr_no_unique" UNIQUE("sr_no")
);

DROP TRIGGER IF EXISTS set_timestamp_db_vujis ON "db_vujis_records";
CREATE TRIGGER set_timestamp_db_vujis
  BEFORE UPDATE ON "db_vujis_records"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 6. APP SETTINGS TABLE
CREATE TABLE IF NOT EXISTS "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"registration_sheet_id" text,
	"registration_sheet_name" text DEFAULT 'Form Responses 1',
	"travel_sheet_name" text DEFAULT 'Travel Desk Records',
	"db_vujis_sheet_name" text DEFAULT 'DB & vujis',
	"drive_folder_id" text,
	"gas_web_app_url" text,
	"session_timeout_minutes" integer DEFAULT 30,
	"backup_gas_web_app_url" text,
	"backup_sheet_id" text,
	"backup_folder_id" text,
	"backup_sheet_id_2" text,
	"backup_folder_id_2" text,
	"dashboard_pivot_sheet_name" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_app_settings ON "app_settings";
CREATE TRIGGER set_timestamp_app_settings
  BEFORE UPDATE ON "app_settings"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 7. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_name" text,
	"user_role" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"status" text DEFAULT 'success',
	"ip_address" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- 8. OPERATION PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS "operation_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"requested_by" integer,
	"requested_by_name" text,
	"operation" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending',
	"approved_by" integer,
	"approved_by_name" text,
	"confirmed_at" timestamp,
	"expires_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS set_timestamp_operation_permissions ON "operation_permissions";
CREATE TRIGGER set_timestamp_operation_permissions
  BEFORE UPDATE ON "operation_permissions"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 9. CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"recipient_id" integer,
	"message" text NOT NULL,
	"file_url" text,
	"file_name" text,
	"is_edited" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- 10. FOREIGN KEY CONSTRAINTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chat_messages_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'chat_messages_recipient_id_users_id_fk'
  ) THEN
    ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'travel_records_registration_id_registrations_id_fk'
  ) THEN
    ALTER TABLE "travel_records" ADD CONSTRAINT "travel_records_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;



-- 11. INDEXES FOR SPEED
CREATE INDEX IF NOT EXISTS idx_users_email ON "users" ("email");
CREATE INDEX IF NOT EXISTS idx_reg_sr_no ON "registrations" ("sr_no");
CREATE INDEX IF NOT EXISTS idx_reg_status ON "registrations" ("status");
CREATE INDEX IF NOT EXISTS idx_trv_reg_id ON "travel_records" ("registration_id");
CREATE INDEX IF NOT EXISTS idx_trv_sr_no ON "travel_records" ("responses_sr_no");

-- 12. SEED INITIAL ROWS
-- Default app settings row
INSERT INTO "app_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

-- Seed default administrator (admin / manthan18)
INSERT INTO "users" ("email", "password_hash", "name", "role")
VALUES (
  'admin',
  '$2b$12$hY10.LHAecIj1EWwj151X.3crCdtrclqwi3vt4q1JSLVf70TY9Oam',
  'System Administrator',
  'admin'
)
ON CONFLICT ("email") DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      name          = EXCLUDED.name,
      role          = EXCLUDED.role;
