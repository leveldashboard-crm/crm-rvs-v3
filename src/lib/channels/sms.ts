// ─── SMS Channel Adapter (Stub) ───────────────────────────────────────────────
// Behind FEATURE_FLAG_SMS. Off by default. Supports Twilio and generic SMPP.
// integration-agent domain.

import type { ChannelAdapter, SendMessageParams, SendMessageResult } from "./index";
import { registerAdapter } from "./index";

class SmsAdapter implements ChannelAdapter {
  channel = "sms" as const;

  isEnabled(): boolean {
    return (
      process.env.FEATURE_FLAG_SMS === "true" &&
      !!(process.env.SMS_API_KEY) &&
      !!(process.env.SMS_FROM_NUMBER)
    );
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const { delegate, template } = params;

    if (!delegate.mobile) {
      return { success: false, channel: "sms", error: "No mobile number for delegate" };
    }

    if (!this.isEnabled()) {
      return { success: false, channel: "sms", error: "SMS channel is not enabled. Set FEATURE_FLAG_SMS=true and provide SMS_API_KEY and SMS_FROM_NUMBER." };
    }

    // Twilio implementation (activate when feature flag is on)
    // Reference: https://www.twilio.com/docs/sms/api
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.SMS_API_KEY;
    const from = process.env.SMS_FROM_NUMBER;

    if (!accountSid || !authToken) {
      return { success: false, channel: "sms", error: "Twilio credentials not configured" };
    }

    try {
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To:   delegate.mobile,
            From: from ?? "",
            Body: template.body,
          }).toString(),
        }
      );

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return { success: false, channel: "sms", error: `Twilio error ${resp.status}: ${text}` };
      }

      const data = await resp.json();
      return { success: true, channel: "sms", messageId: data?.sid };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { success: false, channel: "sms", error: msg };
    }
  }
}

registerAdapter(new SmsAdapter());
export const smsAdapter = new SmsAdapter();
