"use client";

import { useState, useEffect } from "react";
import { Mail, X, Send, Sparkles, CheckCircle } from "lucide-react";
import useSWR from "swr";

interface EmailTemplateItem {
  id: number;
  name: string;
  subject: string;
  body: string;
  sector?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function EmailComposerModal({
  isOpen,
  onClose,
  lead,
  sector = "Bharat Buildcon",
}: {
  isOpen: boolean;
  onClose: () => void;
  lead?: {
    id: number;
    company_name?: string;
    first_name?: string;
    last_name?: string;
    participant_email?: string;
  } | null;
  sector?: string;
}) {
  const [recipient, setRecipient] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const { data: tmplData } = useSWR<{ templates: EmailTemplateItem[] }>(
    isOpen ? `/api/v1/email-templates?sector=${encodeURIComponent(sector)}` : null,
    fetcher
  );

  const templates = tmplData?.templates ?? [];

  useEffect(() => {
    if (lead) {
      setRecipient(lead.participant_email ?? "");
    }
  }, [lead]);

  // Extract variables like {{name}}, {{company}} from body/subject
  const detectPlaceholders = (text: string): string[] => {
    const matches = text.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    const set = new Set(matches.map((m) => m.replace(/[\{\}]/g, "").trim()));
    return Array.from(set);
  };

  const handleSelectTemplate = (idStr: string) => {
    setSelectedTemplateId(idStr);
    const tmpl = templates.find((t) => String(t.id) === idStr);
    if (!tmpl) return;

    setSubject(tmpl.subject);
    setBodyText(tmpl.body);

    const leadName = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Delegate";
    const leadCompany = lead?.company_name ?? "Company";

    // Pre-populate known variables
    const vars = detectPlaceholders(tmpl.subject + " " + tmpl.body);
    const initialValues: Record<string, string> = {};
    vars.forEach((v) => {
      if (v === "name") initialValues[v] = leadName;
      else if (v === "company") initialValues[v] = leadCompany;
      else if (v === "event_date") initialValues[v] = "November 12-14, 2026";
      else initialValues[v] = "";
    });

    setPlaceholders(initialValues);
  };

  // Replace placeholders in text
  const applyPlaceholders = (text: string) => {
    let result = text;
    Object.entries(placeholders).forEach(([key, val]) => {
      const reg = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      result = result.replace(reg, val || `[${key}]`);
    });
    return result;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !subject.trim() || !bodyText.trim()) return;

    setSending(true);
    try {
      const finalSubject = applyPlaceholders(subject);
      const finalBody = applyPlaceholders(bodyText);
      const ccList = cc.split(",").map((c) => c.trim()).filter(Boolean);

      const resp = await fetch("/api/v1/mailer/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead?.id,
          recipientEmail: recipient.trim(),
          ccList,
          subject: finalSubject,
          body: finalBody,
          templateUsed: selectedTemplateId ? templates.find((t) => String(t.id) === selectedTemplateId)?.name : null,
        }),
      });

      if (resp.ok) {
        setSentSuccess(true);
        setTimeout(() => {
          setSentSuccess(false);
          onClose();
        }, 1500);
      }
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const detectedVars = Array.from(new Set([...detectPlaceholders(subject), ...detectPlaceholders(bodyText)]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="glass-card w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0071e3] to-[#5856d6] flex items-center justify-center text-white shadow-xs">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base text-[var(--color-text-primary)]">Send Lead Email</h2>
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                {lead?.company_name ? `To: ${lead.company_name}` : "Compose custom email"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-primary)] text-[var(--color-text-tertiary)]">
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        {sentSuccess ? (
          <div className="p-12 text-center flex flex-col items-center gap-3 my-auto">
            <CheckCircle size={48} className="text-emerald-500 animate-bounce" />
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Email Sent Successfully!</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">Logged against lead record.</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
            {/* Template Selector */}
            {templates.length > 0 && (
              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
                  Select Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="input w-full text-xs bg-[var(--color-bg-primary)] border-[var(--color-border)]"
                >
                  <option value="">Select template (or write custom)…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recipient & CC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
                  To (Email Address) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="delegate@company.com"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="input w-full text-xs bg-[var(--color-bg-primary)] border-[var(--color-border)]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
                  CC List (Comma Separated)
                </label>
                <input
                  type="text"
                  placeholder="supervisor@org.com, info@company.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="input w-full text-xs bg-[var(--color-bg-primary)] border-[var(--color-border)]"
                />
              </div>
            </div>

            {/* Detected Placeholder Prompt Inputs */}
            {detectedVars.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                  <Sparkles size={14} /> Variable Placeholders Detected ({detectedVars.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {detectedVars.map((v) => (
                    <div key={v} className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">{`{{${v}}}`}</span>
                      <input
                        type="text"
                        placeholder={`Fill value for ${v}…`}
                        value={placeholders[v] ?? ""}
                        onChange={(e) => setPlaceholders((prev) => ({ ...prev, [v]: e.target.value }))}
                        className="input py-1 px-2.5 text-xs bg-[var(--color-surface)] border-amber-500/30"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
                Subject *
              </label>
              <input
                type="text"
                required
                placeholder="Email Subject Line…"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input w-full text-xs bg-[var(--color-bg-primary)] border-[var(--color-border)] font-medium"
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider block mb-1">
                Email Body *
              </label>
              <textarea
                required
                rows={7}
                placeholder="Write your email body here…"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="input w-full text-xs bg-[var(--color-bg-primary)] border-[var(--color-border)] font-mono leading-relaxed"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <button type="button" onClick={onClose} className="btn-secondary text-xs px-4 py-2">
                Cancel
              </button>
              <button type="submit" disabled={sending} className="btn-primary text-xs px-5 py-2">
                <Send size={13} /> {sending ? "Sending…" : "Send Email"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
