"use client";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Save, RefreshCw, ExternalLink, CheckCircle2, AlertCircle,
  Plus, Shield, Pencil, Trash2, Eye, EyeOff, X, ChevronDown, Zap, Link2, Wifi, Download
} from "lucide-react";
import { pingGas } from "@/lib/gas-client";
import * as XLSX from "xlsx";

// ─── URL → ID extractors ─────────────────────────────────────────────────────
function extractSheetId(raw: string): string {
  // Full URL: https://docs.google.com/spreadsheets/d/ID/edit...
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Already an ID (no slashes)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw.trim())) return raw.trim();
  return raw.trim();
}

function extractFolderId(raw: string): string {
  // Full URL: https://drive.google.com/drive/folders/ID
  const m = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Shared file URL: /file/d/ID
  const m2 = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  // Already an ID
  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw.trim())) return raw.trim();
  return raw.trim();
}

function extractGasUrl(raw: string): string {
  // Already a valid exec URL
  if (raw.includes("script.google.com") && raw.includes("/exec")) return raw.trim();
  return raw.trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────
type AppSettings = {
  gas_web_app_url: string;
  registration_sheet_id: string;
  registration_sheet_name: string;
  travel_sheet_name: string;
  db_vujis_sheet_name: string;
  drive_folder_id: string;
  session_timeout_minutes: number;
  backup_gas_web_app_url: string;
  backup_sheet_id: string;
  backup_folder_id: string;
  backup_sheet_id_2: string;
  backup_folder_id_2: string;
  dashboard_pivot_sheet_name: string;
  mailer_web_app_url: string;
  mailer_shared_secret: string;
  mailer_mode: string;
  mailer_enabled: boolean;
};

type StaffUser = {
  id: number;
  email: string;
  name: string | null;
  role: string | null;
  createdAt: string | null;
};

type NewUserForm = { email: string; password: string; name: string; role: string };
type EditUserForm = { id: number; name: string; role: string; password: string } | null;

// ─── Constants (outside component) ───────────────────────────────────────────
const ROLES = [
  { value: "admin",      label: "Admin",      desc: "Full access + user management" },
  { value: "supervisor", label: "Supervisor", desc: "Reports + CRM + Travel Desk"   },
  { value: "user",       label: "User",       desc: "Data Entry & Chat only"        },
];

const ROLE_COLOR: Record<string, string> = {
  admin: "#ff3b30", supervisor: "#0071e3", user: "#34c759",
};

// ─── Sub-components OUTSIDE main component (critical for focus stability) ─────

function RoleBadge({ role }: { role: string | null }) {
  const r = role ?? "user";
  const color = ROLE_COLOR[r] ?? "#8e8e93";
  const label = ROLES.find(x => x.value === r)?.label ?? r;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${color}18`, color }}>
      {label}
    </span>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}

function Field({ id, label, value, onChange, type = "text", placeholder, hint }: FieldProps) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        className="input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {hint && <p className="mt-1 text-xs text-[var(--color-text-tertiary)] font-medium">{hint}</p>}
    </div>
  );
}

interface SectionProps {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}

function Section({ isOpen, onToggle, title, icon, color, children }: SectionProps) {
  return (
    <div className="glass-card mb-4 overflow-hidden shadow-sm transition-all">
      <button onClick={onToggle} className={`w-full px-6 py-4 flex items-center gap-3 bg-transparent border-none cursor-pointer transition-colors hover:bg-[var(--color-bg-primary)] ${isOpen ? 'border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/50' : ''}`}>
        <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center shadow-sm" style={{ background: color }}>
          {icon}
        </div>
        <span className="font-semibold text-[0.95rem] flex-1 text-left text-[var(--color-text-primary)] tracking-tight">
          {title}
        </span>
        <ChevronDown size={18} className="text-[var(--color-text-tertiary)] transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
      </button>
      {isOpen && <div className="p-6">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    gas_web_app_url: "", registration_sheet_id: "",
    registration_sheet_name: "Form Responses 1",
    travel_sheet_name: "Travel Desk Records",
    db_vujis_sheet_name: "DB & vujis", drive_folder_id: "",
    session_timeout_minutes: 30,
    backup_gas_web_app_url: "",
    backup_sheet_id: "",
    backup_folder_id: "",
    backup_sheet_id_2: "",
    backup_folder_id_2: "",
    dashboard_pivot_sheet_name: "",
    mailer_web_app_url: "",
    mailer_shared_secret: "",
    mailer_mode: "api",
    mailer_enabled: false,
  });

  const [testingMailer, setTestingMailer] = useState(false);
  const [mailerTestStatus, setMailerTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [mailerTestMsg, setMailerTestMsg] = useState("");

  const testMailerConnection = async () => {
    if (!settings.mailer_web_app_url) {
      toast.error("Please enter the Mailer Web App URL first.");
      return;
    }
    setTestingMailer(true);
    setMailerTestStatus("idle");
    setMailerTestMsg("Testing connection...");
    try {
      const res = await fetch("/api/mailer/getFolderConfig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: [] }),
      });
      const data = await res.json();
      if (data.success || data.folders) {
        setMailerTestStatus("ok");
        setMailerTestMsg(`Connected! Letters: ${data.counts?.letter ?? 0}, Cards: ${data.counts?.card ?? 0}, Itineraries: ${data.counts?.itinerary ?? 0}, Vouchers: ${data.counts?.voucher ?? 0}`);
        toast.success("✅ Mailer connected successfully!");
      } else {
        setMailerTestStatus("error");
        setMailerTestMsg(data.error || "Connection failed. Check URL/Secret.");
        toast.error("⚠️ Mailer connection failed: " + (data.error || "Check setup"));
      }
    } catch (e) {
      setMailerTestStatus("error");
      const message = e instanceof Error ? e.message : String(e);
      setMailerTestMsg(message || "Connection request failed.");
      toast.error("⚠️ Mailer connection request failed");
    } finally {
      setTestingMailer(false);
    }
  };
  const [saving, setSaving] = useState(false);
  const [gasStatus, setGasStatus] = useState<"idle" | "ok" | "error">("idle");
  const [pingMsg, setPingMsg] = useState("");
  const [openSection, setOpenSection] = useState<string>("quicksetup");
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [sheetCreateMsg, setSheetCreateMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncingSheet2, setSyncingSheet2] = useState(false);
  const [syncSheet2Msg, setSyncSheet2Msg] = useState<{ ok: boolean; message: string } | null>(null);
  const [runningBackup, setRunningBackup] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [exportingBackup, setExportingBackup] = useState(false);

  const handleCreateTravelSheet = async () => {
    if (!settings.gas_web_app_url || !settings.registration_sheet_id) {
      toast.error("Save your GAS URL and Sheet ID first before creating the sheet.");
      return;
    }
    setCreatingSheet(true);
    setSheetCreateMsg(null);
    try {
      const res = await fetch("/api/settings/create-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gas_web_app_url:       settings.gas_web_app_url,
          registration_sheet_id: settings.registration_sheet_id,
          sheet_name:            "Travel Desk Sheet 2",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSheetCreateMsg({ ok: true, message: data.message ?? "Sheet 2 created successfully!" });
        toast.success("✅ Travel Desk Sheet 2 created!");
      } else {
        setSheetCreateMsg({ ok: false, message: data.error ?? "Failed to create sheet" });
        toast.error(data.error ?? "Failed to create sheet");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setCreatingSheet(false);
    }
  };

  const handleSyncSheet2 = async () => {
    setSyncingSheet2(true);
    setSyncSheet2Msg(null);
    try {
      const res = await fetch("/api/travel/sync-sheet2", { method: "POST" });
      const data = await res.json();
      setSyncSheet2Msg({ ok: data.ok, message: data.message ?? (data.error ?? "Unknown error") });
      if (data.ok) {
        toast.success(`✅ ${data.message}`);
      } else {
        toast.error(data.error ?? "Sync failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSyncingSheet2(false);
    }
  };

  interface BackupRegistrationRow {
    id?: number;
    sr_no?: number | null;
    timestamp_raw?: string | null;
    title?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    country_name?: string | null;
    passport_country?: string | null;
    region?: string | null;
    participant_mobile?: string | null;
    participant_email?: string | null;
    company_name?: string | null;
    company_website?: string | null;
    designation?: string | null;
    passport_number?: string | null;
    place_of_issue?: string | null;
    date_of_expiry?: string | null;
    nature_of_business?: string | null;
    main_import_product_1?: string | null;
    main_import_product_2?: string | null;
    proof_upload?: string | null;
    products_services?: string | null;
    business_card_upload?: string | null;
    poc?: string | null;
    proof_import?: string | null;
    type_of_poi?: string | null;
    bl_supplier_country?: string | null;
    bl_buyer_country?: string | null;
    status?: string | null;
    flight_hotel_code?: string | null;
    remarks?: string | null;
    bl_status?: string | null;
    bb_invitation_status?: string | null;
    dollar_business?: string | null;
    vujis?: string | null;
    will_not_attend?: string | null;
    is_active?: boolean | null;
    drive_passport_front_url?: string | null;
    drive_passport_back_url?: string | null;
    drive_proof_url?: string | null;
    drive_business_card_url?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }

  interface BackupTravelRow {
    id?: number;
    registration_id?: number | null;
    responses_sr_no?: string | null;
    room_no?: string | null;
    hotel_name?: string | null;
    initial?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    country_name?: string | null;
    country_code?: string | null;
    participant_mobile?: string | null;
    check_in_date?: string | null;
    check_out_date?: string | null;
    room_units?: string | number | null;
    arrival_date?: string | null;
    arrival_flight_no?: string | null;
    arrival_to?: string | null;
    arrival_time?: string | null;
    departure_date?: string | null;
    departure_flight_no?: string | null;
    departure_from?: string | null;
    departure_time?: string | null;
    sector?: string | null;
    company_name?: string | null;
    poc?: string | null;
    status?: string | null;
    reimbursement?: string | null;
    notes?: string | null;
    invoice_amount?: string | null;
    invoice_amount_usd?: string | null;
    invoice_amount_local?: string | null;
    invoice_currency?: string | null;
    ticket_received?: string | null;
    invoice_received?: string | null;
    visa_received?: string | null;
    passport_copy_received?: string | null;
    voucher_received?: string | null;
    reimbursement_amount?: string | null;
    bl?: string | null;
    bl_url?: string | null;
    ticket_url?: string | null;
    invoice_url?: string | null;
    visa_url?: string | null;
    passport_url?: string | null;
    voucher_url?: string | null;
    business_card_url?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }

  interface BackupVujisRow {
    id?: number;
    sr_no?: number | null;
    company_name?: string | null;
    country_name?: string | null;
    region?: string | null;
    proof_of_import_y?: string | null;
    proof_of_import_n?: string | null;
    vujis?: string | null;
    import_value_vujis?: string | null;
    dollar_business?: string | null;
    import_value_dollar?: string | null;
    both_db_vujis?: string | null;
    importing_from_india?: string | null;
    importing_from_other_country?: string | null;
    main_import_product_1?: string | null;
    main_import_product_2?: string | null;
    poc?: string | null;
    reason?: string | null;
    comment?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }

  interface BackupLogRow {
    id?: number;
    user_id?: number | null;
    user_name?: string | null;
    user_role?: string | null;
    action?: string;
    entity_type?: string | null;
    entity_id?: number | null;
    status?: string | null;
    ip_address?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
  }

  const downloadFullBackupXlsx = async () => {
    setExportingBackup(true);
    const tid = toast.loading("Fetching all CRM database tables and preparing Excel backup…");
    try {
      const [regsRes, travRes, logsRes, vujisRes] = await Promise.all([
        fetch("/api/registrations?limit=5000").then(r => r.json()),
        fetch("/api/travel?limit=5000").then(r => r.json()),
        fetch("/api/operation-log?limit=5000").then(r => r.json()),
        fetch("/api/db-vujis?limit=5000").then(r => r.json())
      ]);

      const regsData: BackupRegistrationRow[] = regsRes.rows || [];
      const travData: BackupTravelRow[] = travRes.rows || [];
      const logsData: BackupLogRow[] = logsRes.logs || [];
      const vujisData: BackupVujisRow[] = vujisRes.rows || [];

      const wb = XLSX.utils.book_new();

      // --- Tab 1: Registrations ---
      const regsAoa: (string | number | boolean | null | undefined)[][] = [
        [
          "ID", "Sr No", "Timestamp", "Title", "First Name", "Last Name", "Country Name",
          "Passport Country", "Region", "Mobile", "Email", "Company Name", "Company Website",
          "Designation", "Passport Number", "Place of Issue", "Date of Expiry",
          "Nature of Business", "Main Import Product 1", "Main Import Product 2",
          "Proof Upload Link", "Products Services", "Business Card Link", "POC",
          "Proof of Import", "Type of POI", "B/L Supplier Country", "B/L Buyer Country",
          "Status", "Flight & Hotel", "Remarks", "B/L Status", "BB Invitation Status",
          "Dollar Business", "Vujis", "Will Not Attend", "Active", "Drive Passport Front",
          "Drive Passport Back", "Drive Proof", "Drive Business Card", "Created At", "Updated At"
        ]
      ];
      regsData.forEach((r: BackupRegistrationRow) => {
        regsAoa.push([
          r.id, r.sr_no, r.timestamp_raw, r.title, r.first_name, r.last_name, r.country_name,
          r.passport_country, r.region, r.participant_mobile, r.participant_email, r.company_name, r.company_website,
          r.designation, r.passport_number, r.place_of_issue, r.date_of_expiry,
          r.nature_of_business, r.main_import_product_1, r.main_import_product_2,
          r.proof_upload, r.products_services, r.business_card_upload, r.poc,
          r.proof_import, r.type_of_poi, r.bl_supplier_country, r.bl_buyer_country,
          r.status, r.flight_hotel_code, r.remarks, r.bl_status, r.bb_invitation_status,
          r.dollar_business, r.vujis, r.will_not_attend, r.is_active, r.drive_passport_front_url,
          r.drive_passport_back_url, r.drive_proof_url, r.drive_business_card_url, r.created_at, r.updated_at
        ]);
      });
      const wsRegs = XLSX.utils.aoa_to_sheet(regsAoa);
      XLSX.utils.book_append_sheet(wb, wsRegs, "Registrations");

      // --- Tab 2: Travel Records ---
      const travAoa: (string | number | boolean | null | undefined)[][] = [
        [
          "ID", "Registration ID", "Responses Sr No", "Room No", "Hotel Name", "Initial",
          "First Name", "Last Name", "Country Name", "Country Code", "Mobile",
          "Check In Date", "Check Out Date", "Occupancy", "Arrival Date", "Arrival Flight",
          "Arrival To", "Arrival Time", "Departure Date", "Departure Flight", "Departure From",
          "Departure Time", "Sector", "Company Name", "POC", "Status", "Reimbursement",
          "Notes", "Invoice Amount", "Invoice USD", "Invoice Local", "Invoice Currency",
          "Ticket Received", "Invoice Received", "Visa Received", "Passport Copy Received",
          "Voucher Received", "Reimbursement Amount", "BL", "BL URL", "Ticket URL",
          "Invoice URL", "Visa URL", "Passport URL", "Voucher URL", "Business Card URL",
          "Created At", "Updated At"
        ]
      ];
      travData.forEach((r: BackupTravelRow) => {
        travAoa.push([
          r.id, r.registration_id, r.responses_sr_no, r.room_no, r.hotel_name, r.initial,
          r.first_name, r.last_name, r.country_name, r.country_code, r.participant_mobile,
          r.check_in_date, r.check_out_date, r.room_units, r.arrival_date, r.arrival_flight_no,
          r.arrival_to, r.arrival_time, r.departure_date, r.departure_flight_no, r.departure_from,
          r.departure_time, r.sector, r.company_name, r.poc, r.status, r.reimbursement,
          r.notes, r.invoice_amount, r.invoice_amount_usd, r.invoice_amount_local, r.invoice_currency,
          r.ticket_received, r.invoice_received, r.visa_received, r.passport_copy_received,
          r.voucher_received, r.reimbursement_amount, r.bl, r.bl_url, r.ticket_url,
          r.invoice_url, r.visa_url, r.passport_url, r.voucher_url, r.business_card_url,
          r.created_at, r.updated_at
        ]);
      });
      const wsTrav = XLSX.utils.aoa_to_sheet(travAoa);
      XLSX.utils.book_append_sheet(wb, wsTrav, "Travel Records");

      // --- Tab 3: DB & Vujis Records ---
      const vujisAoa: (string | number | boolean | null | undefined)[][] = [
        [
          "ID", "Sr No", "Company Name", "Country Name", "Region", "Proof Import Y",
          "Proof Import N", "Vujis", "Import Value Vujis", "Dollar Business",
          "Import Value Dollar", "Both DB Vujis", "Importing From India",
          "Importing From Other Country", "Main Import Product 1", "Main Import Product 2",
          "POC", "Reason", "Comment", "Created At", "Updated At"
        ]
      ];
      vujisData.forEach((r: BackupVujisRow) => {
        vujisAoa.push([
          r.id, r.sr_no, r.company_name, r.country_name, r.region, r.proof_of_import_y,
          r.proof_of_import_n, r.vujis, r.import_value_vujis, r.dollar_business,
          r.import_value_dollar, r.both_db_vujis, r.importing_from_india,
          r.importing_from_other_country, r.main_import_product_1, r.main_import_product_2,
          r.poc, r.reason, r.comment, r.created_at, r.updated_at
        ]);
      });
      const wsVujis = XLSX.utils.aoa_to_sheet(vujisAoa);
      XLSX.utils.book_append_sheet(wb, wsVujis, "DB & Vujis");

      // --- Tab 4: Operation Logs ---
      const logsAoa: (string | number | boolean | null | undefined)[][] = [
        [
          "ID", "User ID", "User Name", "User Role", "Action", "Entity Type",
          "Entity ID", "Status", "IP Address", "Metadata", "Created At"
        ]
      ];
      logsData.forEach((l: BackupLogRow) => {
        logsAoa.push([
          l.id, l.user_id, l.user_name, l.user_role, l.action, l.entity_type,
          l.entity_id, l.status, l.ip_address, JSON.stringify(l.metadata), l.created_at
        ]);
      });
      const wsLogs = XLSX.utils.aoa_to_sheet(logsAoa);
      XLSX.utils.book_append_sheet(wb, wsLogs, "Operation Logs");

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `CRM_Full_Database_Backup_${dateStr}.xlsx`);
      toast.success("✅ Database backup spreadsheet downloaded!", { id: tid });
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? `Failed: ${e.message}` : "Failed to compile backup", { id: tid });
    } finally {
      setExportingBackup(false);
    }
  };

  // ── Connection verification state ─────────────────────────────────────────
  type ConnStatus = { ok: boolean; message: string };
  const [verifying, setVerifying] = useState(false);
  const [connStatus, setConnStatus] = useState<{
    gas: ConnStatus; sheet: ConnStatus; drive: ConnStatus;
  } | null>(null);

  const verifyConnections = useCallback(async (overrideSettings?: typeof settings) => {
    const s = overrideSettings ?? settings;
    if (!s.gas_web_app_url) {
      toast.error("Enter the GAS Web App URL first");
      return false;
    }
    setVerifying(true);
    setConnStatus(null);
    try {
      const res = await fetch("/api/settings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const data = await res.json();
      setConnStatus(data.results);
      if (data.ok) {
        toast.success("✅ All systems connected!");
      } else {
        toast.error("⚠️ Some connections failed — check status below");
      }
      return data.ok as boolean;
    } catch {
      toast.error("Verification request failed");
      return false;
    } finally {
      setVerifying(false);
    }
  }, [settings]);

  // ── Quick Setup state (paste URLs → auto-extract IDs) ─────────────────────
  const [quickSheet, setQuickSheet] = useState("");
  const [quickFolder, setQuickFolder] = useState("");
  const [quickGas, setQuickGas] = useState("");
  const [quickApplied, setQuickApplied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const applyQuickSetup = async () => {
    const sheetId  = extractSheetId(quickSheet);
    const folderId = extractFolderId(quickFolder);
    const gasUrl   = extractGasUrl(quickGas);
    const next = {
      ...settings,
      registration_sheet_id: sheetId  || settings.registration_sheet_id,
      drive_folder_id:        folderId || settings.drive_folder_id,
      gas_web_app_url:        gasUrl   || settings.gas_web_app_url,
    };
    setSettings(next);
    // Save first
    try {
      const res = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next),
      });
      if (res.ok) {
        setQuickApplied(true);
        toast.success("✅ Settings saved! Verifying connections…");
        // Auto-verify after save
        const ok = await verifyConnections(next);
        if (ok) {
          toast.info("Initial connection successful. Fetching latest data from Sheet…");
          // Automatically trigger a full sync if this is a fresh setup
          fetch("/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "full" }),
          })
            .then(r => r.json())
            .then(syncData => {
              if (syncData.error) toast.error("Auto-sync failed: " + syncData.error);
              else toast.success("✅ Initial data fetched successfully!");
            })
            .catch(() => toast.error("Failed to fetch initial data"));
        }
      } else {
        toast.error("Save failed");
      }
    } catch { toast.error("Save failed"); }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect? This will wipe your Google integration settings (Registration Sheet, Drive Folder, and GAS URL). Your database records will NOT be deleted.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/settings/disconnect", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Disconnected successfully");
        setSettings(prev => ({
          ...prev,
          gas_web_app_url: "",
          registration_sheet_id: "",
          drive_folder_id: "",
          backup_gas_web_app_url: "",
          backup_sheet_id: "",
          backup_folder_id: "",
          backup_sheet_id_2: "",
          backup_folder_id_2: "",
          dashboard_pivot_sheet_name: "",
          mailer_web_app_url: "",
          mailer_shared_secret: "",
          mailer_mode: "api",
          mailer_enabled: false,
        }));
        setQuickGas("");
        setQuickSheet("");
        setQuickFolder("");
        setQuickApplied(false);
        setConnStatus(null);
      } else {
        toast.error(data.error || "Failed to disconnect");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setDisconnecting(false);
    }
  };


  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState<NewUserForm>({ email: "", password: "", name: "", role: "user" });
  const [showPass, setShowPass] = useState(false);
  const [editUser, setEditUser] = useState<EditUserForm>(null);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) { const d = await res.json(); setUsers(d.users ?? []); }
      else if (res.status === 403) toast.error("Admin role required to view users");
    } finally { setLoadingUsers(false); }
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(({ settings: s }) => {
      if (s) {
        const loaded: AppSettings = {
          gas_web_app_url: s.gas_web_app_url ?? "",
          registration_sheet_id: s.registration_sheet_id ?? "",
          registration_sheet_name: s.registration_sheet_name ?? "Form Responses 1",
          travel_sheet_name: s.travel_sheet_name ?? "Travel Desk Records",
          db_vujis_sheet_name: s.db_vujis_sheet_name ?? "DB & vujis",
          drive_folder_id: s.drive_folder_id ?? "",
          session_timeout_minutes: parseInt(s.session_timeout_minutes ?? "30") || 30,
          backup_gas_web_app_url: s.backup_gas_web_app_url ?? "",
          backup_sheet_id: s.backup_sheet_id ?? "",
          backup_folder_id: s.backup_folder_id ?? "",
          backup_sheet_id_2: s.backup_sheet_id_2 ?? "",
          backup_folder_id_2: s.backup_folder_id_2 ?? "",
          dashboard_pivot_sheet_name: s.dashboard_pivot_sheet_name ?? "",
          mailer_web_app_url: s.mailer_web_app_url ?? "",
          mailer_shared_secret: s.mailer_shared_secret ?? "",
          mailer_mode: s.mailer_mode ?? "api",
          mailer_enabled: !!s.mailer_enabled,
        };
        setSettings(loaded);
        // Auto-verify silently on load if GAS URL is already configured
        if (loaded.gas_web_app_url) {
          fetch("/api/settings/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loaded),
          })
            .then(r => r.json())
            .then(data => { if (data.results) setConnStatus(data.results); })
            .catch(() => {});
        }
      }
    }).catch(console.error);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, [loadUsers]);



  // ── Settings ──────────────────────────────────────────────────────────────
  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Settings saved ✓");
        // Verify connections after save — call API directly to avoid stale closure
        if (settings.gas_web_app_url) {
          setVerifying(true);
          setConnStatus(null);
          fetch("/api/settings/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings),
          })
            .then(r => r.json())
            .then(data => {
              if (data.results) setConnStatus(data.results);
              if (data.ok) toast.success("✅ All connections verified!");
              else toast.error("⚠️ Some connections failed — check status below");
            })
            .catch(() => toast.error("Could not verify connections"))
            .finally(() => setVerifying(false));
        }
      } else {
        toast.error("Save failed");
      }
    } finally { setSaving(false); }
  };

  const testGas = async () => {
    setGasStatus("idle"); setPingMsg("Connecting…");
    const res = await pingGas();
    setGasStatus(res.ok ? "ok" : "error");
    setPingMsg(res.ok ? (res.message ?? "Connected ✓") : (res.error ?? "Connection failed"));
  };

  // ── User CRUD ─────────────────────────────────────────────────────────────
  const addUser = async () => {
    if (!newUser.email.trim()) return toast.error("Username is required");
    if (newUser.password.trim().length < 4) return toast.error("Password must be at least 4 characters");
    setAdding(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User "${newUser.email}" created`);
        setNewUser({ email: "", password: "", name: "", role: "user" });
        setShowAdd(false);
        loadUsers();
      } else {
        toast.error(data.error ?? "Failed to create user");
      }
    } finally { setAdding(false); }
  };

  const updateUser = async () => {
    if (!editUser) return;
    setUpdatingUser(true);
    try {
      const body: Record<string, unknown> = { id: editUser.id, name: editUser.name, role: editUser.role };
      if (editUser.password.trim()) body.password = editUser.password;
      const res = await fetch("/api/admin/users", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) { toast.success("User updated ✓"); setEditUser(null); loadUsers(); }
      else toast.error(data.error ?? "Update failed");
    } finally { setUpdatingUser(false); }
  };

  const deleteUser = async (id: number, email: string) => {
    if (!confirm(`Delete user "${email}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) { toast.success("User deleted"); loadUsers(); }
      else toast.error(data.error ?? "Delete failed");
    } finally { setDeletingId(null); }
  };

  const toggle = (id: string) => setOpenSection(s => s === id ? "" : id);

  return (
    <div className="p-6 md:p-8 max-w-[860px] mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] mb-1.5">Settings</h1>
        <p className="text-[0.9rem] font-medium text-[var(--color-text-secondary)]">
          Manage staff accounts, Google integrations, and system configuration
        </p>
      </div>

      {/* ── ⚡ Quick Setup ─────────────────────────────────────────────────── */}
      <Section
        isOpen={openSection === "quicksetup"}
        onToggle={() => toggle("quicksetup")}
        title="⚡ Quick Setup — Paste & Configure"
        color="linear-gradient(135deg,#ff9500,#ff6b00)"
        icon={<Zap size={18} color="white" />}
      >
        <p className="text-[0.85rem] font-medium text-[var(--color-text-secondary)] mb-5 leading-relaxed bg-[var(--color-bg-primary)] p-3 rounded-lg border border-[var(--color-border)]/50">
          Paste your Google Sheet URL, Drive folder URL, and GAS Web App URL below.
          The IDs are extracted automatically — just click <strong className="text-[var(--color-text-primary)]">Apply & Save</strong>.
        </p>
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <label className="label flex items-center gap-1.5">
              <Link2 size={14} className="text-[var(--color-text-tertiary)]" /> Google Sheet URL or ID
            </label>
            <input
              className="input w-full"
              placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0… or just paste the ID"
              value={quickSheet}
              onChange={e => setQuickSheet(e.target.value)}
            />
            {quickSheet && (
              <p className="text-xs font-medium text-[var(--color-success)] mt-1.5 flex items-center gap-1">
                <CheckCircle2 size={12} /> Extracted ID: <code className="font-mono bg-[var(--color-success-light)] px-1.5 py-0.5 rounded text-[0.7rem]">{extractSheetId(quickSheet)}</code>
              </p>
            )}
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Link2 size={14} className="text-[var(--color-text-tertiary)]" /> Drive Folder URL or ID
            </label>
            <input
              className="input w-full"
              placeholder="https://drive.google.com/drive/folders/1A2B3C… or just paste the ID"
              value={quickFolder}
              onChange={e => setQuickFolder(e.target.value)}
            />
            {quickFolder && (
              <p className="text-xs font-medium text-[var(--color-success)] mt-1.5 flex items-center gap-1">
                <CheckCircle2 size={12} /> Extracted ID: <code className="font-mono bg-[var(--color-success-light)] px-1.5 py-0.5 rounded text-[0.7rem]">{extractFolderId(quickFolder)}</code>
              </p>
            )}
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Link2 size={14} className="text-[var(--color-text-tertiary)]" /> GAS Web App URL
            </label>
            <input
              className="input w-full"
              placeholder="https://script.google.com/macros/s/AKfy…/exec"
              value={quickGas}
              onChange={e => setQuickGas(e.target.value)}
            />
            {quickGas && quickGas.includes("/exec") && (
              <p className="text-xs font-medium text-[var(--color-success)] mt-1.5 flex items-center gap-1"><CheckCircle2 size={12} /> Valid GAS URL detected</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-primary py-2 px-5 shadow-sm font-semibold"
            onClick={applyQuickSetup}
            disabled={!quickSheet && !quickFolder && !quickGas}
          >
            <Zap size={15} /> Apply &amp; Save
          </button>
          {quickApplied && (
            <span className="text-[0.85rem] font-medium text-[var(--color-success)] flex items-center gap-1.5 bg-[var(--color-success-light)] px-3 py-1.5 rounded-lg">
              <CheckCircle2 size={15} /> All configured!
            </span>
          )}
        </div>
      </Section>

      {/* ── Staff Accounts ──────────────────────────────────────────────────── */}
      <Section
        isOpen={openSection === "users"}
        onToggle={() => toggle("users")}
        title="Staff Accounts & Access Control"
        color="linear-gradient(135deg,#0071e3,#5856d6)"
        icon={<Shield size={18} color="white" />}
      >
        <div className="flex justify-end gap-2 mb-5">
          <button className="btn-secondary py-1.5 px-3" onClick={loadUsers} title="Refresh">
            <RefreshCw size={14} className={loadingUsers ? "animate-spin" : ""} />
          </button>
          <button className="btn-primary py-1.5 px-4 shadow-sm" onClick={() => { setShowAdd(v => !v); }}>
            <Plus size={15} /> {showAdd ? "Cancel" : "Add Staff Account"}
          </button>
        </div>

        {/* Add user form — inputs use stable id/value/onChange pattern */}
        {showAdd && (
          <div className="bg-[var(--color-accent-light)] border border-[var(--color-accent)]/20 rounded-xl p-5 mb-5 shadow-inner">
            <h3 className="font-semibold text-[0.95rem] mb-4 text-[var(--color-accent)] flex items-center gap-1.5"><Shield size={14} /> New Staff Account</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <Field
                id="new-email"
                label="Username / Email *"
                value={newUser.email}
                onChange={v => setNewUser(u => ({ ...u, email: v }))}
                placeholder="alice or alice@company.com"
              />
              <div>
                <label className="label" htmlFor="new-password">Password *</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPass ? "text" : "password"}
                    className="input pr-10"
                    value={newUser.password}
                    onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                    placeholder="Min 4 characters"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors rounded bg-transparent border-none cursor-pointer">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <Field
                id="new-name"
                label="Display Name"
                value={newUser.name}
                onChange={v => setNewUser(u => ({ ...u, name: v }))}
                placeholder="Alice Smith"
              />
              <div>
                <label className="label" htmlFor="new-role">Role</label>
                <select id="new-role" className="input" value={newUser.role}
                  onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button className="btn-primary py-2 px-5 shadow-sm font-semibold" onClick={addUser} disabled={adding}>
                {adding ? "Creating…" : "Create Account"}
              </button>
              <button className="btn-secondary py-2 px-4" onClick={() => setShowAdd(false)}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Role guide */}
        <div className="flex gap-2 flex-wrap mb-5">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]/50 text-[0.75rem] font-medium">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ROLE_COLOR[r.value] }} />
              <strong className="text-[var(--color-text-primary)]">{r.label}</strong>
              <span className="text-[var(--color-text-tertiary)]">— {r.desc}</span>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)] shadow-sm">
          {loadingUsers ? (
            <div className="p-8 text-center text-[var(--color-text-tertiary)] text-[0.875rem] font-medium flex justify-center items-center gap-2"><RefreshCw size={16} className="animate-spin" /> Loading…</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-tertiary)] text-[0.875rem] font-medium bg-[var(--color-bg-primary)]/30">
              No staff accounts yet. Create the first account above.
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Account</th><th>Username / Email</th><th>Role</th><th>Created</th><th style={{ width: 80 }}>Actions</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-[0.8125rem] font-bold shadow-sm" style={{ background: `linear-gradient(135deg,${ROLE_COLOR[u.role ?? "user"]},${ROLE_COLOR[u.role ?? "user"]}88)` }}>
                          {(u.name ?? u.email)[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-[0.9rem] text-[var(--color-text-primary)]">{u.name ?? "—"}</span>
                      </div>
                    </td>
                    <td><code style={{ fontSize: "0.8125rem" }}>{u.email}</code></td>
                    <td><RoleBadge role={u.role} /></td>
                    <td className="text-[var(--color-text-tertiary)] font-medium text-xs">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button title="Edit" className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] rounded-md transition-colors cursor-pointer"
                          onClick={() => setEditUser({ id: u.id, name: u.name ?? "", role: u.role ?? "user", password: "" })}>
                          <Pencil size={15} />
                        </button>
                        <button title="Delete" disabled={deletingId === u.id}
                          onClick={() => deleteUser(u.id, u.email)}
                          className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] rounded-md transition-colors cursor-pointer flex items-center">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>

      {/* ── GAS Integration ────────────────────────────────────────────────── */}
      <Section
        isOpen={openSection === "gas"}
        onToggle={() => toggle("gas")}
        title="Google Apps Script (Drive + Sheets)"
        color="linear-gradient(135deg,#4285f4,#34a853)"
        icon={<ExternalLink size={18} color="white" />}
      >
        <div className="mb-5">
          <Field
            id="gas-url"
            label="GAS Web App URL"
            value={settings.gas_web_app_url}
            onChange={v => setSettings(s => ({ ...s, gas_web_app_url: v }))}
            placeholder="https://script.google.com/macros/s/…/exec"
            hint="Deploy gas/Code.gs → Web App → Anyone → copy URL here"
          />
        </div>
        <div className="flex items-center gap-3 mb-5">
          <button className="btn-secondary py-2" onClick={testGas}>
            <RefreshCw size={14} className={gasStatus === "idle" && pingMsg ? "animate-spin" : ""} /> Test Connection
          </button>
          {gasStatus !== "idle" && (
            <span className={`text-[0.85rem] flex items-center gap-1.5 font-semibold px-3 py-1.5 rounded-lg ${gasStatus === "ok" ? "text-[var(--color-success)] bg-[var(--color-success-light)]" : "text-[var(--color-danger)] bg-[var(--color-danger-light)]"}`}>
              {gasStatus === "ok" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {pingMsg}
            </span>
          )}
        </div>
        <div className="bg-[var(--color-bg-primary)] rounded-xl p-5 text-[0.85rem] border border-[var(--color-border)] shadow-inner">
          <p className="font-bold mb-2 flex items-center gap-1.5 text-[var(--color-text-primary)]"><Shield size={14} className="text-[var(--color-accent)]"/> Setup Instructions:</p>
          <ol className="list-decimal pl-5 space-y-1.5 text-[var(--color-text-secondary)] marker:text-[var(--color-text-tertiary)] marker:font-semibold">
            <li>Open <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline font-medium">script.google.com</a> → New Project</li>
            <li>Paste <code className="bg-[var(--color-surface)] px-1 py-0.5 rounded border border-[var(--color-border)] text-xs font-mono">gas/Code.gs</code> → set your folder ID in CONFIG block</li>
            <li>Deploy → Web App → Execute as <strong className="text-[var(--color-text-primary)]">Me</strong> → Access: <strong className="text-[var(--color-text-primary)]">Anyone</strong></li>
            <li>Copy Web App URL → paste above → Save</li>
          </ol>
        </div>
      </Section>

      {/* ── Google Sheets / Drive ──────────────────────────────────────────── */}
      <Section
        isOpen={openSection === "sheets"}
        onToggle={() => toggle("sheets")}
        title="Google Sheets Backup & Drive Folder"
        color="linear-gradient(135deg,#34a853,#0f9d58)"
        icon={<Save size={18} color="white" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="label" htmlFor="sheet-id">Spreadsheet ID or URL</label>
            <input
              id="sheet-id" className="input"
              value={settings.registration_sheet_id}
              onChange={e => setSettings(s => ({ ...s, registration_sheet_id: extractSheetId(e.target.value) }))}
              onPaste={e => {
                e.preventDefault();
                setSettings(s => ({ ...s, registration_sheet_id: extractSheetId(e.clipboardData.getData("text")) }));
              }}
              placeholder="Paste URL or ID — auto-extracted"
            />
            <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)] font-medium">From URL: /spreadsheets/d/<strong className="text-[var(--color-text-secondary)]">[ID]</strong>/edit</p>
          </div>
          <div>
            <label className="label" htmlFor="drive-id">Drive Folder URL or ID</label>
            <input
              id="drive-id" className="input"
              value={settings.drive_folder_id}
              onChange={e => setSettings(s => ({ ...s, drive_folder_id: extractFolderId(e.target.value) }))}
              onPaste={e => {
                e.preventDefault();
                setSettings(s => ({ ...s, drive_folder_id: extractFolderId(e.clipboardData.getData("text")) }));
              }}
              placeholder="Paste URL or ID — auto-extracted"
            />
            <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)] font-medium">From URL: /folders/<strong className="text-[var(--color-text-secondary)]">[ID]</strong></p>
          </div>
          <Field id="reg-sheet-name" label="Registration Sheet Tab"
            value={settings.registration_sheet_name}
            onChange={v => setSettings(s => ({ ...s, registration_sheet_name: v }))}
            placeholder="Form Responses 1" />
          <Field id="travel-sheet-name" label="Travel Desk Sheet Tab"
            value={settings.travel_sheet_name}
            onChange={v => setSettings(s => ({ ...s, travel_sheet_name: v }))}
            placeholder="Travel Desk Records" />
          <Field id="dbvujis-sheet-name" label="DB & Vujis Sheet Tab"
            value={settings.db_vujis_sheet_name}
            onChange={v => setSettings(s => ({ ...s, db_vujis_sheet_name: v }))}
            placeholder="DB & vujis" />
          <div className="md:col-span-2">
            <Field
              id="dashboard-pivot-sheet-name"
              label="Dashboard Pivot Table Sheet Tab"
              value={settings.dashboard_pivot_sheet_name}
              onChange={v => setSettings(s => ({ ...s, dashboard_pivot_sheet_name: v }))}
              placeholder="e.g. Pivot Table, Dashboard Summary, Country Pivot…"
              hint="Name of the Google Sheet tab that contains your pre-computed pivot table. The dashboard will read live pivot data from this tab via GAS. Leave blank to use computed data from the database."
            />
          </div>
        </div>

        {/* ── Sheet 2 Actions ── */}
        <div className="mt-5 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <p className="text-[0.875rem] font-semibold text-[var(--color-text-primary)] mb-1 flex items-center gap-2">
            <Save size={14} className="text-[#34a853]" /> Travel Desk Print Sheet (Sheet 2)
          </p>
          <p className="text-[0.8rem] text-[var(--color-text-tertiary)] mb-3 leading-relaxed">
            Creates a formatted tab <strong className="text-[var(--color-text-secondary)]">&quot;Travel Desk Sheet 2&quot;</strong> with exact columns:
            Sr.No, Hotel, Room, Flights, Invoice, Ticket, Visa, Status. 
            Use <strong>Sync All</strong> to backfill existing records.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-secondary py-2 px-4 font-semibold" onClick={handleCreateTravelSheet} disabled={creatingSheet}>
              <RefreshCw size={14} className={creatingSheet ? "animate-spin" : ""} />
              {creatingSheet ? "Creating…" : "Create / Reset Sheet 2"}
            </button>
            <button className="btn-secondary py-2 px-4 font-semibold" onClick={handleSyncSheet2} disabled={syncingSheet2}>
              <RefreshCw size={14} className={syncingSheet2 ? "animate-spin" : ""} />
              {syncingSheet2 ? "Syncing…" : "Sync All Records → Sheet 2"}
            </button>
          </div>
          {sheetCreateMsg && (
            <p className={`mt-2 text-[0.82rem] font-medium flex items-center gap-1.5 ${sheetCreateMsg.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
              {sheetCreateMsg.ok ? <CheckCircle2 size={13}/> : <AlertCircle size={13}/>} {sheetCreateMsg.message}
            </p>
          )}
          {syncSheet2Msg && (
            <p className={`mt-2 text-[0.82rem] font-medium flex items-center gap-1.5 ${syncSheet2Msg.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
              {syncSheet2Msg.ok ? <CheckCircle2 size={13}/> : <AlertCircle size={13}/>} {syncSheet2Msg.message}
            </p>
          )}
        </div>
      </Section>

      {/* ── Mailer Integration ──────────────────────────────────────────────── */}
      <Section
        isOpen={openSection === "mailer"}
        onToggle={() => toggle("mailer")}
        title="BB Concierge Mailer Integration"
        color="linear-gradient(135deg,#ff2d55,#ff3b30)"
        icon={<Save size={18} color="white" />}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)]">
            <div>
              <span className="font-semibold text-[var(--color-text-primary)]">Enable Mailer Integration</span>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Allow CRM to send personalised emails with Drive attachments</p>
            </div>
            <input
              type="checkbox"
              className="w-5 h-5 accent-[var(--color-accent)] cursor-pointer"
              checked={settings.mailer_enabled}
              onChange={e => setSettings(s => ({ ...s, mailer_enabled: e.target.checked }))}
            />
          </div>

          <Field
            id="mailer-url"
            label="Apps Script Web App URL"
            value={settings.mailer_web_app_url}
            onChange={v => setSettings(s => ({ ...s, mailer_web_app_url: v }))}
            placeholder="https://script.google.com/macros/s/AKfy…/exec"
            hint="URL of your deployed BB Concierge Mailer Apps Script web app"
          />

          <div>
            <label className="label" htmlFor="mailer-secret">Shared Secret Key</label>
            <input
              id="mailer-secret"
              type="password"
              className="input"
              value={settings.mailer_shared_secret}
              onChange={e => setSettings(s => ({ ...s, mailer_shared_secret: e.target.value }))}
              placeholder={settings.mailer_shared_secret ? "••••••••••••••••" : "Enter shared secret key"}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)] font-medium">Shared key to authenticate CRM calls (must match API_SHARED_SECRET in Code.gs). Note: click &quot;Save All Settings&quot; before testing.</p>
          </div>

          <div>
            <label className="label" htmlFor="mailer-mode">Integration Mode</label>
            <select
              id="mailer-mode"
              className="input"
              value={settings.mailer_mode}
              onChange={e => setSettings(s => ({ ...s, mailer_mode: e.target.value }))}
            >
              <option value="api">API Mode (Native Next.js CRM Interface)</option>
              <option value="embed">Embed Mode (Iframe existing web app)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-secondary py-2" onClick={testMailerConnection} disabled={testingMailer}>
              <RefreshCw size={14} className={testingMailer ? "animate-spin" : ""} /> Test Mailer Connection
            </button>
            {mailerTestStatus !== "idle" && (
              <span className={`text-[0.82rem] flex items-center gap-1.5 font-semibold px-3 py-1.5 rounded-lg ${mailerTestStatus === "ok" ? "text-[var(--color-success)] bg-[var(--color-success-light)]" : "text-[var(--color-danger)] bg-[var(--color-danger-light)]"}`}>
                {mailerTestStatus === "ok" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {mailerTestMsg}
              </span>
            )}
          </div>
        </div>
      </Section>

      {/* ── Session Timeout ──────────────────────────────────────────────────── */}
      <Section
        isOpen={openSection === "session"}
        onToggle={() => toggle("session")}
        title="Security — Inactivity Timeout"
        color="linear-gradient(135deg,#ff3b30,#ff6b00)"
        icon={<Shield size={18} color="white" />}
      >
        <p className="text-[0.85rem] text-[var(--color-text-secondary)] mb-5 leading-relaxed">
          Automatically log out all users after this period of inactivity.
          A warning banner will appear 60 seconds before expiry.
        </p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="session-timeout">
              Inactivity Timeout:
              <strong className="ml-2 text-[var(--color-text-primary)]">
                {settings.session_timeout_minutes} minute{settings.session_timeout_minutes !== 1 ? "s" : ""}
              </strong>
            </label>
            <input
              id="session-timeout"
              type="range"
              min="1" max="480" step="5"
              value={settings.session_timeout_minutes}
              onChange={e => setSettings(s => ({ ...s, session_timeout_minutes: parseInt(e.target.value) }))}
              className="w-full mt-2 accent-[var(--color-accent)]"
              style={{ height: "6px", borderRadius: "3px", cursor: "pointer" }}
            />
            <div className="flex justify-between text-[0.7rem] text-[var(--color-text-tertiary)] mt-1">
              <span>1 min</span><span>30 min</span><span>1 hr</span><span>2 hr</span><span>4 hr</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[5,10,15,30,60,120,240].map(m => (
              <button
                key={m}
                onClick={() => setSettings(s => ({ ...s, session_timeout_minutes: m }))}
                className={`px-3 py-1.5 rounded-lg text-[0.8rem] font-semibold border transition-colors cursor-pointer ${
                  settings.session_timeout_minutes === m
                    ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                }`}
              >
                {m < 60 ? `${m}m` : `${m/60}h`}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Backup Configuration ────────────────────────────────────────────── */}
      <Section
        isOpen={openSection === "backup"}
        onToggle={() => toggle("backup")}
        title="Backup Destination — Secondary Google Account"
        color="linear-gradient(135deg,#5856d6,#0071e3)"
        icon={<Save size={18} color="white" />}
      >
        <div className="bg-[var(--color-accent-light)] border border-[var(--color-accent)]/30 rounded-xl p-4 mb-5 text-[0.82rem] text-[var(--color-accent)] font-medium leading-relaxed">
          <p className="mb-1 font-bold">Enterprise Backup Architecture</p>
          <p>Configure a <strong>separate Google account</strong> with its own GAS script, spreadsheet, and Drive folder.
          Every registration and travel record will automatically sync to both primary and backup destinations.
          Up to 2 backup folders/sheets are supported for maximum redundancy.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field
            id="backup-gas-url"
            label="Backup GAS Web App URL"
            value={settings.backup_gas_web_app_url}
            onChange={v => setSettings(s => ({ ...s, backup_gas_web_app_url: v }))}
            placeholder="https://script.google.com/macros/s/…/exec"
            hint="GAS deployed from the secondary/backup Google account"
          />
          <div>
            <label className="label" htmlFor="backup-sheet-id">Backup Spreadsheet ID or URL</label>
            <input
              id="backup-sheet-id" className="input"
              value={settings.backup_sheet_id}
              onChange={e => setSettings(s => ({ ...s, backup_sheet_id: extractSheetId(e.target.value) }))}
              onPaste={e => { e.preventDefault(); setSettings(s => ({ ...s, backup_sheet_id: extractSheetId(e.clipboardData.getData("text")) })); }}
              placeholder="Paste URL or Sheet ID — auto-extracted"
            />
          </div>
          <div>
            <label className="label" htmlFor="backup-folder-id">Backup Drive Folder URL or ID</label>
            <input
              id="backup-folder-id" className="input"
              value={settings.backup_folder_id}
              onChange={e => setSettings(s => ({ ...s, backup_folder_id: extractFolderId(e.target.value) }))}
              onPaste={e => { e.preventDefault(); setSettings(s => ({ ...s, backup_folder_id: extractFolderId(e.clipboardData.getData("text")) })); }}
              placeholder="Paste URL or Folder ID — auto-extracted"
            />
          </div>
          <div className="md:col-span-2">
            <p className="text-[0.8rem] font-bold text-[var(--color-text-secondary)] mb-3 flex items-center gap-1.5">
              <ExternalLink size={13} /> Second Backup (Optional — for double redundancy)
            </p>
          </div>
          <div>
            <label className="label" htmlFor="backup-sheet-id-2">Backup Spreadsheet ID #2 (optional)</label>
            <input
              id="backup-sheet-id-2" className="input"
              value={settings.backup_sheet_id_2}
              onChange={e => setSettings(s => ({ ...s, backup_sheet_id_2: extractSheetId(e.target.value) }))}
              onPaste={e => { e.preventDefault(); setSettings(s => ({ ...s, backup_sheet_id_2: extractSheetId(e.clipboardData.getData("text")) })); }}
              placeholder="Second backup sheet (optional)"
            />
          </div>
          <div>
            <label className="label" htmlFor="backup-folder-id-2">Backup Drive Folder ID #2 (optional)</label>
            <input
              id="backup-folder-id-2" className="input"
              value={settings.backup_folder_id_2}
              onChange={e => setSettings(s => ({ ...s, backup_folder_id_2: extractFolderId(e.target.value) }))}
              onPaste={e => { e.preventDefault(); setSettings(s => ({ ...s, backup_folder_id_2: extractFolderId(e.clipboardData.getData("text")) })); }}
              placeholder="Second backup folder (optional)"
            />
          </div>
          {/* Run backup actions */}
          <div className="md:col-span-2 pt-2 border-t border-[var(--color-border)] mt-2">
            <p className="text-[0.8rem] font-bold text-[var(--color-text-secondary)] mb-3">Manual Backup Trigger</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="btn-primary py-2 px-5 font-semibold shadow-sm"
                onClick={async () => {
                  setRunningBackup(true); setBackupMsg(null);
                  try {
                    const res = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "registration" }) });
                    const data = await res.json();
                    setBackupMsg({ ok: data.ok, message: data.message ?? data.error ?? "Done" });
                    if (data.ok) toast.success(`✅ ${data.message}`); else toast.error(data.error ?? "Backup failed");
                  } catch { toast.error("Request failed"); } finally { setRunningBackup(false); }
                }}
                disabled={runningBackup}
              >
                <RefreshCw size={14} className={runningBackup ? "animate-spin" : ""} />
                {runningBackup ? "Backing up…" : "Backup Registrations Now"}
              </button>
              <button
                className="btn-secondary py-2 px-4 font-semibold"
                onClick={async () => {
                  setRunningBackup(true); setBackupMsg(null);
                  try {
                    const res = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "travel" }) });
                    const data = await res.json();
                    setBackupMsg({ ok: data.ok, message: data.message ?? data.error ?? "Done" });
                    if (data.ok) toast.success(`✅ ${data.message}`); else toast.error(data.error ?? "Backup failed");
                  } catch { toast.error("Request failed"); } finally { setRunningBackup(false); }
                }}
                disabled={runningBackup}
              >
                <RefreshCw size={14} className={runningBackup ? "animate-spin" : ""} />
                {runningBackup ? "Running…" : "Backup Travel Records Now"}
              </button>
            </div>
            {backupMsg && (
              <p className={`mt-2 text-[0.82rem] font-medium flex items-center gap-1.5 ${backupMsg.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                {backupMsg.ok ? <CheckCircle2 size={13}/> : <AlertCircle size={13}/>} {backupMsg.message}
              </p>
            )}
          </div>
          {/* Local Database Backup */}
          <div className="md:col-span-2 pt-4 border-t border-[var(--color-border)] mt-4">
            <p className="text-[0.85rem] font-bold text-[var(--color-text-primary)] mb-1 flex items-center gap-1.5">
              <Download size={14} className="text-[var(--color-accent)]" /> Local Database Backup (Spreadsheet Export)
            </p>
            <p className="text-[0.8rem] text-[var(--color-text-tertiary)] mb-3 leading-relaxed">
              Export and download all database tables (Registrations, Travel Records, DB & Vujis, and Operation Logs) directly into a single multi-tab Excel spreadsheet for local storage.
            </p>
            <button
              className="btn-primary py-2 px-5 font-semibold shadow-sm flex items-center gap-1.5"
              onClick={downloadFullBackupXlsx}
              disabled={exportingBackup}
            >
              <Download size={14} />
              {exportingBackup ? "Generating Excel Backup…" : "Download Full Database Backup (.xlsx)"}
            </button>
          </div>
        </div>
      </Section>

      {/* ── Connection Status Panel — always visible once settings are loaded ──*/}
      <div className="glass-card mb-4 overflow-hidden shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[0.95rem] flex items-center gap-2 text-[var(--color-text-primary)]">
            <Wifi size={16} className={verifying ? "animate-pulse text-[var(--color-accent)]" : connStatus ? "text-[var(--color-accent)]" : "text-[var(--color-text-tertiary)]"} />
            Integration Connection Status
          </h3>
          <div className="flex gap-2">
            <button
              className="btn-secondary py-1 px-3 text-xs font-semibold"
              onClick={() => verifyConnections()}
              disabled={verifying || !settings.gas_web_app_url}
            >
              <RefreshCw size={12} className={verifying ? "animate-spin" : ""} />
              {verifying ? "Checking…" : "Re-check"}
            </button>
            {settings.gas_web_app_url && (
              <button
                className="btn-secondary py-1 px-3 text-xs font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] border-[var(--color-danger)]/30"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                <Trash2 size={12} />
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            )}
          </div>
        </div>
        {!settings.gas_web_app_url && !verifying && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[0.82rem] text-[var(--color-text-tertiary)] font-medium">
            <AlertCircle size={15} className="shrink-0" />
            GAS Web App URL not configured. Paste it in the Quick Setup or GAS Integration section above and save.
          </div>
        )}
        {verifying && !connStatus && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[0.82rem] text-[var(--color-text-secondary)] font-medium">
            <RefreshCw size={15} className="animate-spin shrink-0" />
            Verifying connections…
          </div>
        )}
        {connStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { key: "gas",   label: "Google Apps Script" },
              { key: "sheet", label: "Google Sheet"        },
              { key: "drive", label: "Google Drive"        },
            ] as { key: keyof typeof connStatus; label: string }[]).map(({ key, label }) => {
              const s = connStatus[key];
              return (
                <div key={key} className={`flex items-start gap-2.5 p-3 rounded-xl border text-[0.8rem] font-medium ${
                  s.ok
                    ? "bg-[var(--color-success-light)] border-[var(--color-success)]/30 text-[var(--color-success)]"
                    : "bg-[var(--color-danger-light)] border-[var(--color-danger)]/30 text-[var(--color-danger)]"
                }`}>
                  {s.ok
                    ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    : <AlertCircle  size={16} className="shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="opacity-80 font-normal text-[0.75rem] mt-0.5">{s.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Save ──────────────────────────────────────────────────────────────*/}
      <div className="flex justify-end items-center gap-3 mt-6">
        <button
          className="btn-secondary py-3 px-6 font-semibold"
          onClick={() => verifyConnections()}
          disabled={verifying}
        >
          <Wifi size={15} className={verifying ? "animate-pulse" : ""} />
          {verifying ? "Verifying…" : "Test All Connections"}
        </button>
        <button className="btn-primary py-3 px-8 shadow-md font-bold text-[0.95rem]" onClick={saveSettings} disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save All Settings"}
        </button>
      </div>

      {/* ── Edit User Modal ────────────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-[420px] p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-[1.1rem]">Edit Account</h3>
              <button onClick={() => setEditUser(null)} className="p-1.5 rounded-md hover:bg-[var(--color-bg-primary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-4">
              <Field id="edit-name" label="Display Name"
                value={editUser.name}
                onChange={v => setEditUser(e => e ? { ...e, name: v } : null)}
                placeholder="Alice Smith" />
              <div>
                <label className="label" htmlFor="edit-role">Role</label>
                <select id="edit-role" className="input" value={editUser.role}
                  onChange={e => setEditUser(u => u ? { ...u, role: e.target.value } : null)}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="edit-password">
                  New Password <span className="text-[var(--color-text-tertiary)] font-normal ml-1">(blank = keep current)</span>
                </label>
                <input id="edit-password" type="password" className="input" value={editUser.password}
                  onChange={e => setEditUser(u => u ? { ...u, password: e.target.value } : null)}
                  placeholder="New password (optional)" autoComplete="new-password" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button className="btn-primary flex-1 justify-center py-2.5 font-semibold shadow-sm" onClick={updateUser} disabled={updatingUser}>
                {updatingUser ? "Saving…" : "Save Changes"}
              </button>
              <button className="btn-secondary py-2.5 px-5" onClick={() => setEditUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
