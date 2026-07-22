import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// ─── Users ───────────────────────────────────────────────────────────────────
// v3: role now supports 6 values: master_admin | regional_admin | team_lead |
//     caller | qa_auditor | analyst  (plus legacy: admin | supervisor | user | staff)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role").default("caller").notNull(),
  // v3 additions: region/continent for Regional Admin scoping
  region: text("region"),          // e.g., "Asia Pacific"
  continent: text("continent"),    // e.g., "Asia"
  isActive: boolean("is_active").default(true),
  // Project X: sector assignment & allocated country pools
  sector: text("sector"),
  assignedCountries: jsonb("assigned_countries"),
  lastLoginAt: timestamp("last_login_at"),
  // Presence tracking (Phase 4 — Workforce)
  lastSeenAt: timestamp("last_seen_at"),   // heartbeat timestamp
  presenceStatus: text("presence_status").default("offline"), // online | idle | on_break | offline
  currentShiftId: integer("current_shift_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Sectors (Business Verticals) ─────────────────────────────────────────────
export const sectors = pgTable("sectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),     // Export Calling | Bharat Buildcon | Food Pro
  code: text("code").notNull().unique(),     // export_calling | bharat_buildcon | food_pro
  countries: jsonb("countries"),             // string[]
  defaultPhases: jsonb("default_phases"),     // string[]
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Registrations ────────────────────────────────────────────────────────────
// Columns mirror the Google Form exactly.
// v3 additions: eventId (multi-tenancy), leadTemperature (AI scoring), assignedUserId (allocation)
export const registrations = pgTable("registrations", {
  id: serial("id").primaryKey(),
  // Multi-tenancy readiness (§3.9)
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  // Project X: Sector scoping
  sector: text("sector").default("Bharat Buildcon"),
  srNo: integer("sr_no").unique(),
  timestampRaw: text("timestamp_raw"),
  title: text("title"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  contactPerson: text("contact_person"),
  countryName: text("country_name"),
  passportCountry: text("passport_country"),
  region: text("region"),
  participantMobile: text("participant_mobile"),
  participantEmail: text("participant_email"),
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  designation: text("designation"),
  personalInfo: text("personal_info"),        // Free-text notes (LinkedIn, prior relationships)
  passportNumber: text("passport_number"),
  placeOfIssue: text("place_of_issue"),
  dateOfExpiry: text("date_of_expiry"),
  passportFrontCopy: text("passport_front_copy"),        // Google Form file URL
  passportBackCopy: text("passport_back_copy"),          // Google Form file URL
  natureOfBusiness: text("nature_of_business"),
  mainImportProduct1: text("main_import_product_1"),
  mainImportProduct2: text("main_import_product_2"),
  proofUpload: text("proof_upload"),                     // B/L or other proof file URL
  productsServices: text("products_services"),
  businessCardUpload: text("business_card_upload"),      // Business card file URL
  poc: text("poc"),
  proofImport: text("proof_import"),
  typeOfPoi: text("type_of_poi"),
  blSupplierCountry: text("bl_supplier_country"),
  blBuyerCountry: text("bl_buyer_country"),
  status: text("status"),
  flightHotelCode: text("flight_hotel_code"),
  remarks: text("remarks"),
  emailComments: text("email_comments"),                 // Email interaction notes
  commentsHistory: jsonb("comments_history"),             // Timestamped append-only log: [{text, author, authorRole, timestamp}]
  blStatus: text("bl_status"),
  bbInvitationStatus: text("bb_invitation_status"),
  dollarBusiness: text("dollar_business"),   // GAS: "dollar business" column
  vujis: text("vujis"),                      // GAS: "vujis" column
  willNotAttend: text("will_not_attend"),    // blank = attend, any value = will not attend
  isActive: boolean("is_active").default(true),
  followUpDate: timestamp("follow_up_date"),
  registeredBy: integer("registered_by").references(() => users.id, { onDelete: "set null" }),
  // Google Drive mirrored URLs (set by GAS after upload)
  drivePassportFrontUrl: text("drive_passport_front_url"),
  drivePassportBackUrl: text("drive_passport_back_url"),
  driveProofUrl: text("drive_proof_url"),
  driveBusinessCardUrl: text("drive_business_card_url"),
  // v3: AI Lead Scoring (rules-based heuristic, never auto-applied)
  leadTemperature: text("lead_temperature"),   // Hot | Warm | Cold | null
  leadTemperatureUpdatedAt: timestamp("lead_temperature_updated_at"),
  // v3: Task Allocation — which caller this delegate is assigned to
  assignedCallerId: integer("assigned_caller_id").references(() => users.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at"),
  callerComment: text("caller_comment"),
  callerRemark: text("caller_remark"),
  emailRequestStatus: text("email_request_status").default("none"),
  // v3: Consent tracking (DPDP/GDPR)
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  consentChannel: text("consent_channel"),   // email | whatsapp | sms
  // Interaction tracking for lead scoring
  lastContactedAt: timestamp("last_contacted_at"),
  interactionCount: integer("interaction_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Travel Records ───────────────────────────────────────────────────────────
export const travelRecords = pgTable("travel_records", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  registrationId: integer("registration_id").references(() => registrations.id, { onDelete: "set null" }),
  responsesSrNo: text("responses_sr_no"),
  roomNo: text("room_no"),
  hotelName: text("hotel_name"),
  initial: text("initial"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  countryName: text("country_name"),
  countryCode: text("country_code"),
  participantMobile: text("participant_mobile"),
  checkInDate: text("check_in_date"),
  checkOutDate: text("check_out_date"),
  roomUnits: numeric("room_units", { precision: 4, scale: 2 }),
  arrivalDate: text("arrival_date"),
  arrivalFlightNo: text("arrival_flight_no"),
  arrivalTo: text("arrival_to"),
  arrivalTime: text("arrival_time"),
  departureDate: text("departure_date"),
  departureFlightNo: text("departure_flight_no"),
  departureFrom: text("departure_from"),
  departureTime: text("departure_time"),
  sector: text("sector"),
  companyName: text("company_name"),
  poc: text("poc"),
  status: text("status").default("Pending"),
  reimbursement: text("reimbursement").default("No"),
  notes: text("notes"),
  invoiceAmount: text("invoice_amount"),
  invoiceAmountUsd: text("invoice_amount_usd"),
  invoiceAmountLocal: text("invoice_amount_local"),
  invoiceCurrency: text("invoice_currency"),
  ticketReceived: text("ticket_received").default("No"),
  invoiceReceived: text("invoice_received").default("No"),
  visaReceived: text("visa_received").default("No"),
  passportCopyReceived: text("passport_copy_received").default("No"),
  voucherReceived: text("voucher_received").default("No"),
  reimbursementAmount: text("reimbursement_amount"),
  bl: text("bl"),
  blUrl: text("bl_url"),
  // Google Drive URLs
  ticketUrl: text("ticket_url"),
  invoiceUrl: text("invoice_url"),
  visaUrl: text("visa_url"),
  passportUrl: text("passport_url"),
  voucherUrl: text("voucher_url"),
  businessCardUrl: text("business_card_url"),
  // Drive file IDs for management
  ticketDriveId: text("ticket_drive_id"),
  invoiceDriveId: text("invoice_drive_id"),
  visaDriveId: text("visa_drive_id"),
  passportDriveId: text("passport_drive_id"),
  voucherDriveId: text("voucher_drive_id"),
  businessCardDriveId: text("business_card_drive_id"),
  blDriveId: text("bl_drive_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── DB & Vujis Records ───────────────────────────────────────────────────────
export const dbVujisRecords = pgTable("db_vujis_records", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  srNo: integer("sr_no").unique(),
  companyName: text("company_name"),
  countryName: text("country_name"),
  region: text("region"),
  proofOfImportY: text("proof_of_import_y"),
  proofOfImportN: text("proof_of_import_n"),
  vujis: text("vujis"),
  importValueVujis: text("import_value_vujis"),
  dollarBusiness: text("dollar_business"),
  importValueDollar: text("import_value_dollar"),
  bothDbVujis: text("both_db_vujis"),
  importingFromIndia: text("importing_from_india"),
  importingFromOtherCountry: text("importing_from_other_country"),
  mainImportProduct1: text("main_import_product_1"),
  mainImportProduct2: text("main_import_product_2"),
  poc: text("poc"),
  reason: text("reason"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── App Settings ─────────────────────────────────────────────────────────────
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  registrationSheetId: text("registration_sheet_id"),
  registrationSheetName: text("registration_sheet_name").default("Form Responses 1"),
  travelSheetName: text("travel_sheet_name").default("Travel Desk Records"),
  dbVujisSheetName: text("db_vujis_sheet_name").default("DB & vujis"),
  driveFolderId: text("drive_folder_id"),
  gasWebAppUrl: text("gas_web_app_url"),
  // ── Session security ───────────────────────────────────────────────────────
  sessionTimeoutMinutes: integer("session_timeout_minutes").default(30),
  // ── Backup destination (secondary GAS / different Google account) ──────────
  backupGasWebAppUrl: text("backup_gas_web_app_url"),
  backupSheetId: text("backup_sheet_id"),
  backupFolderId: text("backup_folder_id"),
  backupSheetId2: text("backup_sheet_id_2"),
  backupFolderId2: text("backup_folder_id_2"),
  // ── Dashboard Pivot Table ────────────────────────────────────────────────
  dashboardPivotSheetName: text("dashboard_pivot_sheet_name"),
  // ── Mailer Integration ──────────────────────────────────────────────────
  mailerWebAppUrl: text("mailer_web_app_url"),
  mailerSharedSecret: text("mailer_shared_secret"),
  mailerMode: text("mailer_mode").default("api"),
  mailerEnabled: boolean("mailer_enabled").default(false),
  // ── v3 Enterprise: Multi-tenancy ──────────────────────────────────────────
  eventId: text("event_id").default("bharat_buildcon_2026"),
  eventName: text("event_name").default("Bharat Buildcon 2026"),
  // ── v3 Enterprise: Feature Flags ──────────────────────────────────────────
  featureFlagGamification: boolean("feature_flag_gamification").default(false),
  featureFlagWhatsapp: boolean("feature_flag_whatsapp").default(false),
  featureFlagSms: boolean("feature_flag_sms").default(false),
  featureFlagAiScoring: boolean("feature_flag_ai_scoring").default(true),
  // ── v3 Enterprise: Escalation Thresholds ──────────────────────────────────
  escalationLevel1Hours: integer("escalation_level1_hours").default(2),   // caller → team_lead
  escalationLevel2Hours: integer("escalation_level2_hours").default(6),   // team_lead → regional_admin
  // ── v3 Enterprise: Notification Channels ──────────────────────────────────
  notificationsEnabled: boolean("notifications_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Audit Log ────────────────────────────────────────────────────────────────
// v3: immutable (no update/delete allowed by rules), Master-Admin-only reads
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026"),
  userId: integer("user_id"),
  userName: text("user_name"),
  userRole: text("user_role"),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  status: text("status").default("success"),  // success | failed | blocked | pending
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Operation Permissions ────────────────────────────────────────────────────
export const operationPermissions = pgTable("operation_permissions", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026"),
  requestedBy: integer("requested_by"),
  requestedByName: text("requested_by_name"),
  operation: text("operation").notNull(),
  description: text("description"),
  status: text("status").default("pending"),   // pending | approved | denied | revoked
  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  confirmedAt: timestamp("confirmed_at"),
  expiresAt: timestamp("expires_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026"),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").references(() => users.id, { onDelete: "cascade" }),
  threadType: text("thread_type").default("task"), // task | team | direct | group
  threadId: text("thread_id"),                     // taskId or sector code or groupId
  message: text("message").notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileSize: text("file_size"),
  attachments: jsonb("attachments"),              // [{ url, fileName, fileSize }]
  isEdited: boolean("is_edited").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Chat Groups ──────────────────────────────────────────────────────────────
export const chatGroups = pgTable("chat_groups", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026"),
  name: text("name").notNull(),
  description: text("description"),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdByName: text("created_by_name"),
  memberIds: jsonb("member_ids"), // Array of user IDs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


// ─── Task Batches ─────────────────────────────────────────────────────────────
export const taskBatches = pgTable("task_batches", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  sector: text("sector").default("Bharat Buildcon"),
  name: text("name").notNull(),
  assignedToId: integer("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  assignedToIds: jsonb("assigned_to_ids"),         // string/number[]
  assignedToName: text("assigned_to_name"),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  country: text("country"),
  continent: text("continent"),
  timeLink: text("time_link"),                      // Calendly / Google Meet link
  status: text("status").default("pending"),        // pending | in_progress | completed | cancelled
  completionPercent: integer("completion_percent").default(0),
  totalDelegates: integer("total_delegates").default(0),
  completedDelegates: integer("completed_delegates").default(0),
  // TTL lock for concurrent access prevention
  lockedBy: integer("locked_by"),
  lockedAt: timestamp("locked_at"),
  lockExpiresAt: timestamp("lock_expires_at"),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Task Phases ──────────────────────────────────────────────────────────────
export const taskPhases = pgTable("task_phases", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => taskBatches.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  status: text("status").default("not_started").notNull(), // not_started | in_progress | done
  updatedById: integer("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedByName: text("updated_by_name"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Roster ───────────────────────────────────────────────────────────────────
export const roster = pgTable("roster", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026"),
  week: text("week").notNull(),                     // e.g. "2026-W30"
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  userName: text("user_name"),
  sector: text("sector").notNull(),
  country: text("country").notNull(),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Targets ──────────────────────────────────────────────────────────────────
export const targets = pgTable("targets", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026"),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  userName: text("user_name"),
  sector: text("sector"),
  period: text("period").notNull(),                  // 3m | 6m | 9m
  goal: integer("goal").default(0).notNull(),
  currentAttainment: integer("current_attainment").default(0).notNull(),
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Email Logs ───────────────────────────────────────────────────────────────
export const emailLogs = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026"),
  leadId: integer("lead_id").references(() => registrations.id, { onDelete: "set null" }),
  sentById: integer("sent_by_id").references(() => users.id, { onDelete: "set null" }),
  sentByName: text("sent_by_name"),
  recipientEmail: text("recipient_email").notNull(),
  ccList: jsonb("cc_list"),                          // string[]
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  templateUsed: text("template_used"),
  status: text("status").default("sent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Email Templates ──────────────────────────────────────────────────────────
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026"),
  name: text("name").notNull(),
  sector: text("sector"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),                     // supports {{name}}, {{company}}, etc.
  createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Shifts & Attendance ──────────────────────────────────────────────────────
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  shiftName: text("shift_name"),
  timezone: text("timezone").default("Asia/Kolkata"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  days: text("days"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const attendanceLogs = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  loginAt: timestamp("login_at"),
  logoutAt: timestamp("logout_at"),
  breakMinutes: integer("break_minutes").default(0),
  totalWorkMinutes: integer("total_work_minutes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Call Logs ────────────────────────────────────────────────────────────────
export const callLogs = pgTable("call_logs", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  callerId: integer("caller_id").references(() => users.id, { onDelete: "set null" }),
  registrationId: integer("registration_id").references(() => registrations.id, { onDelete: "set null" }),
  direction: text("direction").default("outbound"),
  status: text("status"),
  durationSeconds: integer("duration_seconds"),
  recordingUrl: text("recording_url"),
  telephonyProvider: text("telephony_provider"),
  externalCallId: text("external_call_id"),
  notes: text("notes"),
  scriptFlags: jsonb("script_flags"),
  followUpDue: timestamp("follow_up_due"),
  followUpCompleted: boolean("follow_up_completed").default(false),
  followUpCompletedAt: timestamp("follow_up_completed_at"),
  escalationLevel: integer("escalation_level").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("call_logs_caller_id_idx").on(table.callerId),
  index("call_logs_registration_id_idx").on(table.registrationId),
  index("call_logs_follow_up_due_idx").on(table.followUpDue),
]);

// ─── QA Scores ────────────────────────────────────────────────────────────────
export const qaScores = pgTable("qa_scores", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  callLogId: integer("call_log_id").references(() => callLogs.id, { onDelete: "cascade" }),
  auditorId: integer("auditor_id").references(() => users.id, { onDelete: "set null" }),
  auditorName: text("auditor_name"),
  callerId: integer("caller_id").references(() => users.id, { onDelete: "set null" }),
  callerName: text("caller_name"),
  scriptAdherence: integer("script_adherence"),
  tone: integer("tone"),
  dataAccuracy: integer("data_accuracy"),
  customerHandling: integer("customer_handling"),
  overallScore: numeric("overall_score", { precision: 4, scale: 2 }),
  notes: text("notes"),
  rubricData: jsonb("rubric_data"),
  scoredAt: timestamp("scored_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── KPI Snapshots ────────────────────────────────────────────────────────────
export const kpiSnapshots = pgTable("kpi_snapshots", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  snapshotDate: text("snapshot_date").notNull(),
  totalAssigned: integer("total_assigned").default(0),
  totalContacted: integer("total_contacted").default(0),
  totalConverted: integer("total_converted").default(0),
  followUpsMissed: integer("follow_ups_missed").default(0),
  followUpsCompleted: integer("follow_ups_completed").default(0),
  avgQaScore: numeric("avg_qa_score", { precision: 4, scale: 2 }),
  performanceScore: numeric("performance_score", { precision: 5, scale: 2 }),
  rank: integer("rank"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("kpi_snapshots_user_date_idx").on(table.userId, table.snapshotDate),
  index("kpi_snapshots_event_date_idx").on(table.eventId, table.snapshotDate),
]);

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  targetUserId: integer("target_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sourceUserId: integer("source_user_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  payload: jsonb("payload"),
  priority: text("priority").default("normal"),
  read: boolean("read").default(false),
  readAt: timestamp("read_at"),
  escalationLevel: integer("escalation_level").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("notifications_target_user_idx").on(table.targetUserId, table.read),
  index("notifications_created_at_idx").on(table.createdAt),
]);

// ─── Consent Records ──────────────────────────────────────────────────────────
export const consentRecords = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").default("bharat_buildcon_2026").notNull(),
  delegateSrNo: integer("delegate_sr_no"),
  registrationId: integer("registration_id").references(() => registrations.id, { onDelete: "set null" }),
  channel: text("channel").notNull(),
  consentGiven: boolean("consent_given").notNull(),
  consentWithdrawnAt: timestamp("consent_withdrawn_at"),
  source: text("source"),
  recordedById: integer("recorded_by_id").references(() => users.id, { onDelete: "set null" }),
  ipAddress: text("ip_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Sector = typeof sectors.$inferSelect;
export type NewSector = typeof sectors.$inferInsert;
export type Registration = typeof registrations.$inferSelect;
export type NewRegistration = typeof registrations.$inferInsert;
export type TravelRecord = typeof travelRecords.$inferSelect;
export type NewTravelRecord = typeof travelRecords.$inferInsert;
export type DbVujisRecord = typeof dbVujisRecords.$inferSelect;
export type NewDbVujisRecord = typeof dbVujisRecords.$inferInsert;
export type AppSettings = typeof appSettings.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type AttendanceLog = typeof attendanceLogs.$inferSelect;
export type CallLog = typeof callLogs.$inferSelect;
export type NewCallLog = typeof callLogs.$inferInsert;
export type QAScore = typeof qaScores.$inferSelect;
export type NewQAScore = typeof qaScores.$inferInsert;
export type TaskBatch = typeof taskBatches.$inferSelect;
export type NewTaskBatch = typeof taskBatches.$inferInsert;
export type TaskPhase = typeof taskPhases.$inferSelect;
export type NewTaskPhase = typeof taskPhases.$inferInsert;
export type Roster = typeof roster.$inferSelect;
export type NewRoster = typeof roster.$inferInsert;
export type Target = typeof targets.$inferSelect;
export type NewTarget = typeof targets.$inferInsert;
export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type ConsentRecord = typeof consentRecords.$inferSelect;
