// ─── Gmail Channel Adapter ────────────────────────────────────────────────────
// Wraps the existing GAS mailer infrastructure as a channel adapter.
// integration-agent domain.

import type { ChannelAdapter, SendMessageParams, SendMessageResult } from "./index";
import { registerAdapter } from "./index";

class GmailAdapter implements ChannelAdapter {
  channel = "gmail" as const;

  isEnabled(): boolean {
    // Enabled if GAS mailer URL is configured
    return !!(process.env.GAS_MAILER_URL || process.env.NEXT_PUBLIC_GAS_MAILER_URL);
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const { delegate, template, senderName } = params;

    if (!delegate.email) {
      return { success: false, channel: "gmail", error: "No email address for delegate" };
    }

    const mailerUrl = process.env.GAS_MAILER_URL;
    if (!mailerUrl) {
      return { success: false, channel: "gmail", error: "GAS mailer URL not configured" };
    }

    try {
      const payload = {
        to: delegate.email,
        subject: template.subject ?? "Bharat Buildcon 2026 — Important Information",
        body: template.body,
        senderName: senderName ?? "Bharat Buildcon Team",
        delegateName: delegate.name,
        delegateSrNo: delegate.srNo,
      };

      const secret = process.env.MAILER_SHARED_SECRET;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (secret) headers["x-shared-secret"] = secret;

      const resp = await fetch(mailerUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return { success: false, channel: "gmail", error: `GAS returned ${resp.status}: ${text}` };
      }

      const result = await resp.json().catch(() => ({}));
      return { success: true, channel: "gmail", messageId: result.messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { success: false, channel: "gmail", error: msg };
    }
  }
}

// Auto-register on import
registerAdapter(new GmailAdapter());

export const gmailAdapter = new GmailAdapter();
