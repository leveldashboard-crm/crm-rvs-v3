import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { appSettings, registrations } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// ─── POST /api/sync ── Fetch live data from GAS → upsert into Neon ────────────
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role ?? "staff";
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Load settings
  const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (!settings?.gasWebAppUrl) {
    return NextResponse.json({ error: "GAS Web App URL not configured. Set it in Admin → Settings." }, { status: 400 });
  }
  if (!settings.registrationSheetId) {
    return NextResponse.json({ error: "Sheet ID not configured. Set it in Admin → Settings." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = (body as { mode?: string }).mode ?? "full"; // "full" | "incremental"

  try {
    // ── 1. Call GAS to get sheet data ─────────────────────────────────────────
    const gasUrl = new URL(settings.gasWebAppUrl);
    gasUrl.searchParams.set("action", "getRows");
    gasUrl.searchParams.set("sheetId", settings.registrationSheetId);
    gasUrl.searchParams.set("sheetName", settings.registrationSheetName || "Form Responses 1");
    gasUrl.searchParams.set("mode", mode);

    const gasRes = await fetch(gasUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(60_000), // 60s for large sheets
    });

    if (!gasRes.ok) {
      throw new Error(`GAS returned ${gasRes.status}: ${await gasRes.text()}`);
    }

    const gasData = await gasRes.json() as {
      ok: boolean;
      rows: Record<string, unknown>[];
      error?: string;
    };

    if (!gasData.ok) throw new Error(gasData.error ?? "GAS returned ok:false");

    const rows = gasData.rows ?? [];
    if (rows.length === 0) return NextResponse.json({ ok: true, upserted: 0, skipped: 0, sheetRows: 0, message: "No rows returned from sheet" });

    // ── 2. Map raw sheet rows → DB fields ─────────────────────────────────────
    const mapped = rows.map(mapSheetRow);

    // ── 3. Batch upsert into database (by sr_no) ──────────────────────────────
    const BATCH = 1000;
    let upserted = 0;
    let skipped  = 0; // rows that had no Sr No (blank/null) — cannot be upserted

    for (let i = 0; i < mapped.length; i += BATCH) {
      const batch = mapped.slice(i, i + BATCH);

      const validBatch = batch
        .filter((row) => {
          if (!row.srNo) {
            skipped++;
            return false;
          }
          return true;
        })
        .map((row) => ({
          ...row,
          srNo: row.srNo as number,
          updatedAt: new Date(),
        }));

      if (validBatch.length > 0) {
        await db
          .insert(registrations)
          .values(validBatch)
          .onConflictDoUpdate({
            target: registrations.srNo,
            set: {
              firstName:             sql`excluded.first_name`,
              lastName:              sql`excluded.last_name`,
              title:                 sql`excluded.title`,
              countryName:           sql`excluded.country_name`,
              passportCountry:       sql`excluded.passport_country`,
              region:                sql`excluded.region`,
              participantMobile:     sql`excluded.participant_mobile`,
              participantEmail:      sql`excluded.participant_email`,
              companyName:           sql`excluded.company_name`,
              companyWebsite:        sql`excluded.company_website`,
              designation:           sql`excluded.designation`,
              passportNumber:        sql`excluded.passport_number`,
              placeOfIssue:          sql`excluded.place_of_issue`,
              dateOfExpiry:          sql`excluded.date_of_expiry`,
              natureOfBusiness:      sql`excluded.nature_of_business`,
              mainImportProduct1:    sql`excluded.main_import_product_1`,
              mainImportProduct2:    sql`excluded.main_import_product_2`,
              productsServices:      sql`excluded.products_services`,
              poc:                   sql`excluded.poc`,
              proofImport:           sql`excluded.proof_import`,
              typeOfPoi:             sql`excluded.type_of_poi`,
              blSupplierCountry:     sql`excluded.bl_supplier_country`,
              blBuyerCountry:        sql`excluded.bl_buyer_country`,
              status:                sql`excluded.status`,
              flightHotelCode:       sql`excluded.flight_hotel_code`,
              remarks:               sql`excluded.remarks`,
              blStatus:              sql`excluded.bl_status`,
              bbInvitationStatus:    sql`excluded.bb_invitation_status`,
              dollarBusiness:        sql`excluded.dollar_business`,
              vujis:                 sql`excluded.vujis`,
              willNotAttend:         sql`excluded.will_not_attend`,
              passportFrontCopy:     sql`excluded.passport_front_copy`,
              passportBackCopy:      sql`excluded.passport_back_copy`,
              proofUpload:           sql`excluded.proof_upload`,
              businessCardUpload:    sql`excluded.business_card_upload`,
              drivePassportFrontUrl: sql`excluded.drive_passport_front_url`,
              drivePassportBackUrl:  sql`excluded.drive_passport_back_url`,
              driveProofUrl:         sql`excluded.drive_proof_url`,
              driveBusinessCardUrl:  sql`excluded.drive_business_card_url`,
              updatedAt:             sql`excluded.updated_at`,
            },
          });
        upserted += validBatch.length;
      }
    }

    // ── 4. Get authoritative DB count ──────────────────────────────────────────
    const [{ dbCount }] = await db.select({ dbCount: sql<number>`count(*)` }).from(registrations);

    console.log(`[POST /api/sync] sheetRows=${rows.length} upserted=${upserted} skipped=${skipped} dbCount=${Number(dbCount)}`);
    return NextResponse.json({
      ok: true,
      upserted,
      skipped,
      sheetRows: rows.length,
      dbCount: Number(dbCount),
      total: rows.length,
      message: `Synced ${upserted} rows (${skipped} skipped — no Sr No). DB now has ${Number(dbCount)} records.`,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    console.error("[POST /api/sync]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET /api/sync — Status / last sync info ──────────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings] = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(registrations);

  return NextResponse.json({
    configured: !!(settings?.gasWebAppUrl && settings?.registrationSheetId),
    gasWebAppUrl: settings?.gasWebAppUrl ?? null,
    sheetId: settings?.registrationSheetId ?? null,
    sheetName: settings?.registrationSheetName ?? null,
    driveFolderId: settings?.driveFolderId ?? null,
    dbCount: Number(count),
    lastSettingsUpdate: settings?.updatedAt ?? null,
  });
}

// ─── Row mapper: sheet column headers → Drizzle insert object ─────────────────
// KEY FIX: Uses case-insensitive fuzzy matching across ALL keys in the row object.
// This handles any column header casing from GAS (e.g. "Will not attend",
// "WILL NOT ATTEND", "Dollar Business", "dollar business", "Vujis", "VUJIS", etc.)
function mapSheetRow(r: Record<string, unknown>) {
  // Build a lowercase key → original key index for case-insensitive lookup
  const lowerKeyMap = new Map<string, string>();
  for (const k of Object.keys(r)) {
    // Also index by collapsed (remove spaces) version for fuzzy match
    lowerKeyMap.set(k.toLowerCase().trim(), k);
    lowerKeyMap.set(k.toLowerCase().replace(/[\s_\-/]+/g, ""), k);
  }

  /** Lookup value by trying multiple candidate labels — case-insensitive + fuzzy */
  const s = (candidates: string[]): string | null => {
    for (const candidate of candidates) {
      // 1. Exact match
      if (r[candidate] != null && String(r[candidate]).trim()) {
        return String(r[candidate]).replace(/[\r\n]+/g, " ").trim();
      }
      // 2. Case-insensitive match
      const lower = candidate.toLowerCase().trim();
      const originalKey = lowerKeyMap.get(lower)
        ?? lowerKeyMap.get(lower.replace(/[\s_\-/]+/g, ""));
      if (originalKey && r[originalKey] != null && String(r[originalKey]).trim()) {
        return String(r[originalKey]).replace(/[\r\n]+/g, " ").trim();
      }
    }
    return null;
  };

  const n = (keys: string[]): number | null => {
    const v = s(keys); if (!v) return null;
    const num = Number(v); return isNaN(num) ? null : num;
  };

  // Robust product matching — scans ALL keys for "import" + "product"
  let p1: string | null = null, p2: string | null = null;
  for (const [k, v] of Object.entries(r)) {
    const lk = k.toLowerCase().trim();
    if (lk.includes("import") && lk.includes("product")) {
      const val = v != null && String(v).trim() ? String(v).replace(/[\r\n]+/g, " ").trim() : null;
      if (lk.includes("2")) { if (!p2) p2 = val; }
      else                  { if (!p1) p1 = val; }
    }
  }

  // ── Will Not Attend: scan ALL keys fuzzy ──────────────────────────────────
  // Handles: "Will Not Attend", "will not attend", "WILL NOT ATTEND",
  //          "Will not attend", "willnotattend", "Will_Not_Attend", etc.
  let willNotAttendVal: string | null = null;
  for (const [k, v] of Object.entries(r)) {
    const lk = k.toLowerCase().replace(/[\s_\-]+/g, "");
    if (lk === "willnotattend") {
      if (v != null && String(v).trim()) willNotAttendVal = String(v).replace(/[\r\n]+/g, " ").trim();
      break;
    }
  }

  // ── Dollar Business: scan ALL keys fuzzy ──────────────────────────────────
  let dollarBizVal: string | null = null;
  for (const [k, v] of Object.entries(r)) {
    const lk = k.toLowerCase().replace(/[\s_\-]+/g, "");
    if (lk === "dollarbusiness" || lk === "dollarbiz") {
      if (v != null && String(v).trim()) dollarBizVal = String(v).replace(/[\r\n]+/g, " ").trim();
      break;
    }
  }

  // ── Vujis: scan ALL keys fuzzy ────────────────────────────────────────────
  let vujisVal: string | null = null;
  for (const [k, v] of Object.entries(r)) {
    const lk = k.toLowerCase().trim();
    if (lk === "vujis") {
      if (v != null && String(v).trim()) vujisVal = String(v).replace(/[\r\n]+/g, " ").trim();
      break;
    }
  }

  return {
    srNo:                  n(["Sr No", "Sr. No", "SR NO", "sr_no", "srno"]),
    timestampRaw:          s(["Timestamp", "timestamp_raw"]),
    title:                 s(["Title", "title"]),
    firstName:             s(["First Name (As Written on Passport)", "First Name", "first_name"]),
    lastName:              s(["Last Name (As written on Passport)", "Last Name", "last_name"]),
    countryName:           s(["Country Name", "country_name"]),
    passportCountry:       s(["Passport Country", "passport_country"]),
    region:                s(["Region", "region"]),
    participantMobile:     s(["Participant Mobile/Whatsapp number (With ISD Code)", "Participant Mobile", "participant_mobile"]),
    participantEmail:      s(["Participant Email", "participant_email"]),
    companyName:           s(["Company Name", "company_name"]),
    companyWebsite:        s(["Company Website", "company_website"]),
    designation:           s(["Designation of the Representative", "Designation", "designation"]),
    passportNumber:        s(["Passport Number", "passport_number"]),
    placeOfIssue:          s(["Place of Issue", "place_of_issue"]),
    dateOfExpiry:          s(["Date of Expiry", "date_of_expiry"]),
    passportFrontCopy:     s(["Passport Front Copy", "passport_front_copy"]),
    passportBackCopy:      s(["Passport Back Copy", "passport_back_copy"]),
    natureOfBusiness:      s(["Nature of Business", "nature_of_business"]),
    mainImportProduct1:    p1 ?? s(["Your Main Import Product - 1", "main_import_product_1"]),
    mainImportProduct2:    p2 ?? s(["Your Main Import Product - 2", "main_import_product_2"]),
    proofUpload:           s(["Upload one proof of your Import (Please enter valid document Eg: - Bill of Lading)", "proof_upload"]),
    productsServices:      s(["Which of the below describes your products/services", "products_services"]),
    businessCardUpload:    s(["Please upload your Business Card", "business_card_upload"]),
    poc:                   s(["POC", "poc"]),
    proofImport:           s(["Proof of Import", "proof_import"]),
    typeOfPoi:             s(["Type of POI", "type_of_poi"]),
    blSupplierCountry:     s(["B/L Supplier Country", "bl_supplier_country"]),
    blBuyerCountry:        s(["B/L Buyer Country", "bl_buyer_country"]),
    status:                s(["Status", "status"]),
    flightHotelCode:       s(["Flight & Hotel", "flight_hotel_code"]),
    remarks:               s(["Remarks", "remarks"]),
    blStatus:              s(["B/L Status", "bl_status"]),
    bbInvitationStatus:    s(["BB Invitation letter status", "bb_invitation_status"]),
    dollarBusiness:        dollarBizVal ?? s(["Dollar Business", "dollar_business", "Dollar biz", "DollarBusiness"]),
    vujis:                 vujisVal     ?? s(["Vujis", "vujis", "VUJIS"]),
    willNotAttend:         willNotAttendVal ?? s(["Will Not Attend", "will_not_attend", "Will not attend", "WILL NOT ATTEND"]),
    drivePassportFrontUrl: s(["drive_passport_front_url"]),
    drivePassportBackUrl:  s(["drive_passport_back_url"]),
    driveProofUrl:         s(["drive_proof_url"]),
    driveBusinessCardUrl:  s(["drive_business_card_url"]),
  };
}
