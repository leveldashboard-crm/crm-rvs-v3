import "server-only";
import { getFolderConfig, buildIndex, matchDelegates, rematchOne } from "./index-engine";
import { getDrafts, saveDraft, deleteDraft } from "./drafts";
import { sendOne, getSendLog, getSheetUrl, searchDriveFiles, verifySmtp } from "./sender";
import type { SendPayload } from "./types";

// ─── Unified mailer function dispatcher ─────────────────────────────────────
// All mailer operations are implemented directly in Next.js (PostgreSQL + Nodemailer).
// No external Google Apps Script dependency required.

export async function callMailer<T = unknown>(
  fn: string,
  args: unknown[] = [],
  senderInfo?: { name?: string; email?: string }
): Promise<{ success: boolean; result?: T; error?: string; [key: string]: unknown }> {
  switch (fn) {
    case "verifySmtp":
      return verifySmtp(
        args[0] as Parameters<typeof verifySmtp>[0]
      ) as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "getFolderConfig":
      return getFolderConfig() as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "buildIndex":
      return buildIndex() as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "matchDelegates":
      return matchDelegates(
        (args[0] as Parameters<typeof matchDelegates>[0]) || []
      ) as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "rematchOne":
      return rematchOne(
        (args[0] as Parameters<typeof rematchOne>[0]) || {}
      ) as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "getDrafts":
      return getDrafts() as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "saveDraft":
      return saveDraft(args[0] as Parameters<typeof saveDraft>[0]) as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "deleteDraft":
      return deleteDraft(String(args[0] || "")) as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "sendOne":
      return sendOne(args[0] as SendPayload, senderInfo) as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "getSendLog":
      return getSendLog() as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "searchDriveFiles":
      return searchDriveFiles(String(args[0] || "")) as Promise<{ success: boolean; result?: T; [key: string]: unknown }>;

    case "getSheetUrl":
      return getSheetUrl() as { success: boolean; result?: T; [key: string]: unknown };

    default:
      return { success: false, error: `Unknown mailer function: ${fn}` };
  }
}

