// ─── WhatsApp Channel Adapter (Stub) ─────────────────────────────────────────
// Behind FEATURE_FLAG_WHATSAPP. Off by default. Plug in WhatsApp Business API
// credentials when ready to activate.
// integration-agent domain.

import type { ChannelAdapter, SendMessageParams, SendMessageResult } from "./index";
import { registerAdapter } from "./index";

class WhatsAppAdapter implements ChannelAdapter {
  channel = "whatsapp" as const;

  isEnabled(): boolean {
    // Enable via feature flag + API credentials
    return (
      process.env.FEATURE_FLAG_WHATSAPP === "true" &&
      !!(process.env.WHATSAPP_API_KEY) &&
      !!(process.env.WHATSAPP_PHONE_NUMBER_ID)
    );
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const { delegate, template } = params;

    if (!delegate.mobile) {
      return { success: false, channel: "whatsapp", error: "No mobile number for delegate" };
    }

    if (!this.isEnabled()) {
      return { success: false, channel: "whatsapp", error: "WhatsApp channel is not enabled. Set FEATURE_FLAG_WHATSAPP=true and provide API credentials." };
    }

    // TODO: Implement WhatsApp Business API call when feature flag is activated
    // POST https://graph.facebook.com/v18.0/{phone_number_id}/messages
    // with Authorization: Bearer {WHATSAPP_API_KEY}
    // Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages

    const apiKey = process.env.WHATSAPP_API_KEY;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    try {
      const resp = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: delegate.mobile.replace(/\D/g, ""),
            type: "text",
            text: { body: template.body },
          }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        return { success: false, channel: "whatsapp", error: `WhatsApp API error ${resp.status}: ${text}` };
      }

      const data = await resp.json();
      return { success: true, channel: "whatsapp", messageId: data?.messages?.[0]?.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { success: false, channel: "whatsapp", error: msg };
    }
  }
}

registerAdapter(new WhatsAppAdapter());
export const whatsappAdapter = new WhatsAppAdapter();
