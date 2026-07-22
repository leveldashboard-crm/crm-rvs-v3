import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ensureMailerSchema, loadMailerSettings } from "./db";
import type { SendPayload } from "./types";

// ─── Fetch a Drive file as a Buffer via public URL ────────────────────────────
async function fetchDriveFileBuffer(fileId: string, apiKey: string): Promise<{ buffer: Buffer; filename: string; contentType: string } | null> {
  if (!fileId) return null;
  try {
    // Try with API key first (requires Drive API enabled), fallback to export URL
    const urls = apiKey
      ? [
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`,
          `https://drive.google.com/uc?export=download&id=${fileId}`,
        ]
      : [`https://drive.google.com/uc?export=download&id=${fileId}`];

    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) continue;
        const contentType = res.headers.get("content-type") || "application/octet-stream";
        // Reject HTML responses (e.g. "download warning" pages)
        if (contentType.includes("text/html")) continue;
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Extract filename from content-disposition if present
        const cd = res.headers.get("content-disposition") || "";
        const fnMatch = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)/i);
        const filename = fnMatch ? decodeURIComponent(fnMatch[1].trim()) : `attachment_${fileId}.pdf`;
        return { buffer, filename, contentType };
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Build Nodemailer transporter ─────────────────────────────────────────────
function createTransporter(settings: Awaited<ReturnType<typeof loadMailerSettings>>) {
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    tls: { rejectUnauthorized: false },
  });
}

// ─── Verify SMTP Connection ───────────────────────────────────────────────────
export async function verifySmtp(customSettings?: {
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
}) {
  await ensureMailerSchema();
  const dbSettings = await loadMailerSettings();

  const settings = {
    smtpHost: customSettings?.smtpHost || dbSettings.smtpHost,
    smtpPort: customSettings?.smtpPort !== undefined ? customSettings.smtpPort : dbSettings.smtpPort,
    smtpUser: customSettings?.smtpUser !== undefined ? customSettings.smtpUser : dbSettings.smtpUser,
    smtpPass: customSettings?.smtpPass !== undefined ? customSettings.smtpPass : dbSettings.smtpPass,
    smtpFrom: customSettings?.smtpFrom !== undefined ? customSettings.smtpFrom : dbSettings.smtpFrom,
    folderLetter: dbSettings.folderLetter,
    folderCard: dbSettings.folderCard,
    folderItinerary: dbSettings.folderItinerary,
    folderVoucher: dbSettings.folderVoucher,
    driveApiKey: dbSettings.driveApiKey,
  };

  if (settings.smtpPass === "••••") {
    settings.smtpPass = dbSettings.smtpPass;
  }

  if (!settings.smtpUser || !settings.smtpPass) {
    return { success: false, error: "SMTP credentials not configured." };
  }

  try {
    const transporter = createTransporter(settings);
    await transporter.verify();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Send One Email ───────────────────────────────────────────────────────────
export async function sendOne(payload: SendPayload, senderInfo?: { name?: string; email?: string }) {
  await ensureMailerSchema();
  const settings = await loadMailerSettings();

  if (!settings.smtpUser || !settings.smtpPass) {
    return { success: false, error: "SMTP credentials not configured. Go to Settings → Mailer to set up Gmail/SMTP." };
  }

  const transporter = createTransporter(settings);
  const from = settings.smtpFrom || settings.smtpUser;

  // Build attachments
  interface MailAttachment {
    filename: string;
    content: Buffer;
    contentType: string;
  }
  const attachments: MailAttachment[] = [];

  // Drive attachments
  const driveAttDefs = [
    { send: payload.sendLetter, fileId: payload.letterFileId, label: "Letter" },
    { send: payload.sendCard, fileId: payload.cardFileId, label: "Card" },
    { send: payload.sendItinerary, fileId: payload.itineraryFileId, label: "Itinerary" },
    { send: payload.sendVoucher, fileId: payload.voucherFileId, label: "Voucher" },
  ];

  for (const att of driveAttDefs) {
    if (att.send && att.fileId) {
      const file = await fetchDriveFileBuffer(att.fileId, settings.driveApiKey);
      if (file) {
        attachments.push({ filename: file.filename, content: file.buffer, contentType: file.contentType });
      }
    }
  }

  // Custom base64 attachments
  if (Array.isArray(payload.customAttachments)) {
    for (const att of payload.customAttachments) {
      if (att?.base64Data && att.fileName) {
        const buf = Buffer.from(att.base64Data, "base64");
        attachments.push({ filename: att.fileName, content: buf, contentType: att.mimeType || "application/octet-stream" });
      }
    }
  }

  const plainBody = payload.plainBody || payload.htmlBody.replace(/<[^>]+>/g, "");

  try {
    await transporter.sendMail({
      from: `"BB Concierge" <${from}>`,
      to: payload.toEmail,
      cc: payload.cc || undefined,
      bcc: payload.bcc || undefined,
      subject: payload.subject,
      text: plainBody,
      html: payload.htmlBody,
      attachments: attachments.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    // Log success
    await logSend({
      recipient: payload.recipientName,
      email: payload.toEmail,
      subject: payload.subject,
      draftName: payload.draftName,
      hasLetter: !!(payload.sendLetter && payload.letterFileId),
      hasCard: !!(payload.sendCard && payload.cardFileId),
      hasItinerary: !!(payload.sendItinerary && payload.itineraryFileId),
      hasVoucher: !!(payload.sendVoucher && payload.voucherFileId),
      customAttachments: payload.customAttachments?.map(a => a.fileName).join(", ") || "",
      sentByName: senderInfo?.name || "System User",
      sentByEmail: senderInfo?.email || "",
      status: "success",
      error: "",
    });

    return { success: true };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);

    // Log error
    await logSend({
      recipient: payload.recipientName,
      email: payload.toEmail,
      subject: payload.subject,
      draftName: payload.draftName,
      hasLetter: false, hasCard: false, hasItinerary: false, hasVoucher: false,
      customAttachments: "",
      sentByName: senderInfo?.name || "System User",
      sentByEmail: senderInfo?.email || "",
      status: "error",
      error: errMsg,
    }).catch(() => {});

    return { success: false, error: errMsg };
  }
}

// ─── Log Send ─────────────────────────────────────────────────────────────────
interface SendLogEntry {
  recipient: string;
  email: string;
  subject: string;
  draftName: string;
  hasLetter: boolean;
  hasCard: boolean;
  hasItinerary: boolean;
  hasVoucher: boolean;
  customAttachments: string;
  sentByName?: string;
  sentByEmail?: string;
  status: string;
  error: string;
}

async function logSend(entry: SendLogEntry) {
  await db.execute(sql`
    INSERT INTO mailer_send_log
      (recipient, email, subject, draft_name, has_letter, has_card, has_itinerary, has_voucher, custom_attachments, sent_by_name, sent_by_email, status, error)
    VALUES
      (${entry.recipient}, ${entry.email}, ${entry.subject}, ${entry.draftName},
       ${entry.hasLetter}, ${entry.hasCard}, ${entry.hasItinerary}, ${entry.hasVoucher},
       ${entry.customAttachments}, ${entry.sentByName || "User"}, ${entry.sentByEmail || ""}, ${entry.status}, ${entry.error})
  `);
}

// ─── Get Send Log ─────────────────────────────────────────────────────────────
export async function getSendLog() {
  try {
    await ensureMailerSchema();
    const rows = Array.from(await db.execute(sql`
      SELECT
        sent_at, recipient, email, subject, draft_name,
        has_letter, has_card, has_itinerary, has_voucher,
        custom_attachments, sent_by_name, sent_by_email, status, error
      FROM mailer_send_log
      ORDER BY id DESC
      LIMIT 200
    `)) as Record<string, unknown>[];

    const result = rows.map(r => ({
      sentOn: r.sent_at ? String(r.sent_at) : "",
      timestamp: r.sent_at ? String(r.sent_at) : "",
      recipient: String(r.recipient || ""),
      email: String(r.email || ""),
      subject: String(r.subject || ""),
      draft: String(r.draft_name || ""),
      letter: !!r.has_letter,
      card: !!r.has_card,
      itinerary: !!r.has_itinerary,
      voucher: !!r.has_voucher,
      customAttachments: String(r.custom_attachments || ""),
      sentByName: String(r.sent_by_name || "User"),
      sentByEmail: String(r.sent_by_email || ""),
      status: String(r.status || "success"),
      error: String(r.error || ""),
    }));
    return { success: true, result };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}


// ─── Get Sheet URL (not applicable — return dashboard link) ──────────────────
export function getSheetUrl() {
  return { success: true, result: null };
}

// ─── Search Drive Files via index ─────────────────────────────────────────────
export async function searchDriveFiles(query: string) {
  try {
    await ensureMailerSchema();
    const norm = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
    const rows = Array.from(await db.execute(sql`
      SELECT file_type, file_name, file_id, file_url
      FROM mailer_file_index
      WHERE name_normalized ILIKE ${"%" + norm + "%"}
      LIMIT 20
    `)) as Record<string, unknown>[];
    return {
      success: true,
      result: rows.map(r => ({
        type: String(r.file_type),
        fileName: String(r.file_name),
        fileId: String(r.file_id),
        fileUrl: String(r.file_url),
      })),
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
