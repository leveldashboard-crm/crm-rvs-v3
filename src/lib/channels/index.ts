// ─── ConnectBuild CRM v3 — Channel Adapter Interface ─────────────────────────
// §3.6: Common sendMessage interface behind which Gmail, WhatsApp, SMS plug in.
// integration-agent domain.

export type Channel = "gmail" | "whatsapp" | "sms";

export interface DelegateContact {
  srNo?: number | null;
  name: string;
  email?: string | null;
  mobile?: string | null;
  countryName?: string | null;
}

export interface MessageTemplate {
  subject?: string;    // For email
  body: string;
  templateId?: string;
}

export interface SendMessageParams {
  channel: Channel;
  delegate: DelegateContact;
  template: MessageTemplate;
  senderName?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageResult {
  success: boolean;
  channel: Channel;
  messageId?: string;
  error?: string;
}

export interface ChannelAdapter {
  channel: Channel;
  isEnabled(): boolean;
  send(params: SendMessageParams): Promise<SendMessageResult>;
}

// ─── Channel Registry ─────────────────────────────────────────────────────────
const adapters = new Map<Channel, ChannelAdapter>();

export function registerAdapter(adapter: ChannelAdapter): void {
  adapters.set(adapter.channel, adapter);
}

export function getAdapter(channel: Channel): ChannelAdapter | undefined {
  return adapters.get(channel);
}

/**
 * Universal send — routes to the appropriate channel adapter.
 * Returns error result if channel is not enabled or not registered.
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const adapter = adapters.get(params.channel);
  if (!adapter) {
    return { success: false, channel: params.channel, error: `No adapter registered for channel: ${params.channel}` };
  }
  if (!adapter.isEnabled()) {
    return { success: false, channel: params.channel, error: `Channel ${params.channel} is not enabled` };
  }
  return adapter.send(params);
}

/**
 * Send via the best available channel for a delegate.
 * Order: gmail (if email) → whatsapp (if mobile) → sms (if mobile)
 */
export async function sendBestChannel(
  delegate: DelegateContact,
  template: MessageTemplate,
  options?: { preferredChannel?: Channel; senderName?: string }
): Promise<SendMessageResult> {
  const preferred = options?.preferredChannel;

  const candidates: Channel[] = preferred
    ? [preferred, "gmail", "whatsapp", "sms"]
    : ["gmail", "whatsapp", "sms"];

  for (const channel of [...new Set(candidates)]) {
    if (channel === "gmail" && !delegate.email) continue;
    if ((channel === "whatsapp" || channel === "sms") && !delegate.mobile) continue;

    const result = await sendMessage({ channel, delegate, template, senderName: options?.senderName });
    if (result.success) return result;
  }

  return { success: false, channel: "gmail", error: "All channels failed or unavailable" };
}
