import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureMailerSchema, loadMailerSettings } from "./db";

// ─── Name normalisation (mirrors GAS logic) ───────────────────────────────────
export function normalizeName(name: string): string {
  return name
    .replace(/\.[a-zA-Z0-9]{2,5}$/, "") // strip extension
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Google Drive File Listing via API key ────────────────────────────────────
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

async function listDriveFolder(folderId: string, apiKey: string): Promise<DriveFile[]> {
  if (!folderId || !apiKey) return [];
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    `'${folderId}' in parents and trashed=false`
  )}&fields=files(id,name,mimeType)&pageSize=500&key=${apiKey}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json() as { files?: DriveFile[] };
    return data.files || [];
  } catch {
    return [];
  }
}

// ─── Get Folder Config ────────────────────────────────────────────────────────
export async function getFolderConfig() {
  await ensureMailerSchema();
  const settings = await loadMailerSettings();
  const types = ["letter", "card", "itinerary", "voucher"] as const;
  const folders: Record<string, string | null> = {};
  const counts: Record<string, number> = {};

  for (const type of types) {
    const folderId = settings[`folder${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof settings] as string;
    folders[type] = folderId || null;

    const rows = Array.from(await db.execute(sql`
      SELECT COUNT(*) as cnt FROM mailer_file_index WHERE file_type = ${type}
    `));
    counts[type] = Number((rows[0] as { cnt: string })?.cnt || 0);
  }

  return { success: true, folders, counts };
}

// ─── Build Index ──────────────────────────────────────────────────────────────
export async function buildIndex() {
  await ensureMailerSchema();
  const settings = await loadMailerSettings();
  const types = ["letter", "card", "itinerary", "voucher"] as const;
  const folderMap = {
    letter: settings.folderLetter,
    card: settings.folderCard,
    itinerary: settings.folderItinerary,
    voucher: settings.folderVoucher,
  };

  // Clear existing index
  await db.execute(sql`TRUNCATE TABLE mailer_file_index`);

  let totalIndexed = 0;
  for (const type of types) {
    const folderId = folderMap[type];
    if (!folderId) continue;

    const files = await listDriveFolder(folderId, settings.driveApiKey);
    for (const file of files) {
      const fileUrl = `https://drive.google.com/file/d/${file.id}/view?usp=sharing`;
      const nameNorm = normalizeName(file.name);
      await db.execute(sql`
        INSERT INTO mailer_file_index (file_type, file_name, file_id, file_url, name_normalized)
        VALUES (${type}, ${file.name}, ${file.id}, ${fileUrl}, ${nameNorm})
      `);
      totalIndexed++;
    }
  }

  return { success: true, indexed: totalIndexed };
}

// ─── Read Index ───────────────────────────────────────────────────────────────
interface IndexRow {
  file_type: string;
  file_name: string;
  file_id: string;
  file_url: string;
  name_normalized: string;
}

async function readIndex(): Promise<IndexRow[]> {
  const rows = Array.from(await db.execute(sql`
    SELECT file_type, file_name, file_id, file_url, name_normalized
    FROM mailer_file_index ORDER BY id
  `));
  return rows as unknown as IndexRow[];
}

// ─── Delegate Matching Engine ─────────────────────────────────────────────────
interface DelegateInput {
  rowIndex: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  participant_email?: string;
  passport_country?: string;
  country_name?: string;
  company_name?: string;
  designation?: string;
  region?: string;
  title?: string;
  [key: string]: unknown;
}

export interface MatchResult {
  rowIndex: number;
  fullName: string;
  email: string;
  citizenship: string;
  country: string;
  company: string;
  designation: string;
  region: string;
  title: string;
  firstName: string;
  lastName: string;
  hasEmail: boolean;
  hasManualOverride: boolean;
  confidence: string;
  letter: { fileId: string; fileName: string; fileUrl: string } | null;
  hasLetter: boolean;
  card: { fileId: string; fileName: string; fileUrl: string } | null;
  hasCard: boolean;
  itinerary: { fileId: string; fileName: string; fileUrl: string } | null;
  hasItinerary: boolean;
  voucher: { fileId: string; fileName: string; fileUrl: string } | null;
  hasVoucher: boolean;
}

function matchSingle(delegate: DelegateInput, index: IndexRow[]): MatchResult {
  const fullName = String(delegate.full_name || "");
  const firstName = String(delegate.first_name || "");
  const lastName = String(delegate.last_name || "");
  const email = String(delegate.participant_email || "");

  const normFull = normalizeName(fullName);
  const normFirst = normalizeName(firstName);
  const normLast = normalizeName(lastName);

  const searchTerms = [
    normFull,
    normFirst && normLast ? `${normFirst} ${normLast}` : "",
    normFirst && normLast ? `${normLast} ${normFirst}` : "",
    normFirst,
    normLast,
  ].filter(Boolean);

  const result: MatchResult = {
    rowIndex: Number(delegate.rowIndex ?? 0),
    fullName,
    email,
    citizenship: String(delegate.passport_country || ""),
    country: String(delegate.country_name || ""),
    company: String(delegate.company_name || ""),
    designation: String(delegate.designation || ""),
    region: String(delegate.region || ""),
    title: String(delegate.title || ""),
    firstName,
    lastName,
    hasEmail: !!email,
    hasManualOverride: false,
    confidence: "none",
    letter: null, hasLetter: false,
    card: null, hasCard: false,
    itinerary: null, hasItinerary: false,
    voucher: null, hasVoucher: false,
  };

  const types = ["letter", "card", "itinerary", "voucher"] as const;
  for (const type of types) {
    const typeFiles = index.filter(f => f.file_type === type);
    let bestMatch: IndexRow | null = null;
    let bestConf = "none";

    // 1. Exact match
    for (const file of typeFiles) {
      for (const term of searchTerms) {
        if (term && file.name_normalized === term) {
          bestMatch = file; bestConf = "exact"; break;
        }
      }
      if (bestConf === "exact") break;
    }

    // 2. Contains match
    if (!bestMatch) {
      for (const file of typeFiles) {
        for (const term of searchTerms) {
          if (term && term.length >= 3) {
            if (file.name_normalized.includes(term) || term.includes(file.name_normalized)) {
              bestMatch = file; bestConf = "name"; break;
            }
          }
        }
        if (bestMatch) break;
      }
    }

    // 3. Last name fuzzy
    if (!bestMatch && normLast.length >= 3) {
      for (const file of typeFiles) {
        if (file.name_normalized.includes(normLast)) {
          bestMatch = file; bestConf = "fuzzy"; break;
        }
      }
    }

    if (bestMatch) {
      const link = { fileId: bestMatch.file_id, fileName: bestMatch.file_name, fileUrl: bestMatch.file_url };
      (result as unknown as Record<string, unknown>)[type] = link;
      (result as unknown as Record<string, unknown>)[`has${type.charAt(0).toUpperCase() + type.slice(1)}`] = true;
      if (result.confidence !== "exact") result.confidence = bestConf;
    }
  }

  if ((result.hasLetter || result.hasCard || result.hasItinerary || result.hasVoucher) && result.confidence === "none") {
    result.confidence = "fuzzy";
  }

  return result;
}

export async function matchDelegates(delegates: DelegateInput[]) {
  await ensureMailerSchema();
  const index = await readIndex();
  const results = delegates.map(d => matchSingle(d, index));
  return { success: true, result: results };
}

export async function rematchOne(delegate: DelegateInput) {
  await ensureMailerSchema();
  const index = await readIndex();
  return { success: true, result: matchSingle(delegate, index) };
}
