"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageSquare, Send, Paperclip, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";
import useSWR from "swr";
import { isComplianceRole } from "@/lib/rbac";

interface ChatMessageItem {
  id: number;
  userId: number;
  userName: string | null;
  message: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: string | null;
  attachments?: Array<{ url: string; fileName: string; fileSize?: string }>;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TaskTeamChat({
  threadType = "task",
  threadId = "general",
  title = "Team Coordination Chat",
  userRole = "caller",
}: {
  threadType?: "task" | "team";
  threadId?: string;
  title?: string;
  userRole?: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; fileName: string; fileSize: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isReadOnly = isComplianceRole(userRole);

  const apiUrl = `/api/v1/chat?threadType=${threadType}&threadId=${encodeURIComponent(threadId)}`;
  const { data, mutate } = useSWR<{ messages: ChatMessageItem[] }>(apiUrl, fetcher, {
    refreshInterval: 5000,
  });

  const messages = data?.messages ?? [];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isReadOnly || sending) return;

    setSending(true);
    try {
      const resp = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadType,
          threadId,
          message: text.trim(),
          fileUrl: attachment?.url ?? null,
          fileName: attachment?.fileName ?? null,
          fileSize: attachment?.fileSize ?? null,
          attachments: attachment ? [attachment] : null,
        }),
      });

      if (resp.ok) {
        setText("");
        setAttachment(null);
        mutate();
      }
    } finally {
      setSending(false);
    }
  };

  const handleSimulateAttachment = () => {
    const fakeFileName = `doc_proof_${Date.now().toString().slice(-4)}.pdf`;
    setAttachment({
      url: `https://storage.googleapis.com/demo-bucket/${fakeFileName}`,
      fileName: fakeFileName,
      fileSize: "1.4 MB",
    });
  };

  return (
    <div className="glass-card flex flex-col h-[520px] overflow-hidden border border-[var(--color-border)] rounded-2xl shadow-sm bg-[var(--color-surface)]">
      {/* ── Header ── */}
      <div className="px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#0071e3] to-[#5856d6] flex items-center justify-center text-white shadow-xs">
            <MessageSquare size={16} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--color-text-primary)]">{title}</h3>
            <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">
              {threadType === "task" ? `Task #${threadId}` : `Sector Thread (${threadId})`}
            </p>
          </div>
        </div>
        {isReadOnly && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <ShieldAlert size={12} /> Tech/Compliance Read-Only Mode
          </span>
        )}
      </div>

      {/* ── Messages Feed ── */}
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="my-auto text-center text-xs text-[var(--color-text-tertiary)] flex flex-col items-center gap-2 py-10">
            <MessageSquare size={28} className="opacity-30" />
            No messages logged in this thread yet.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-1 max-w-[85%] animate-fade-in self-start">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--color-text-tertiary)] px-1">
                <span>{m.userName ?? "User"}</span>
                <span>•</span>
                <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]/60 text-xs text-[var(--color-text-primary)] leading-relaxed shadow-2xs">
                {m.message}
                {(m.fileName || (m.attachments && m.attachments.length > 0)) && (
                  <div className="mt-2.5 p-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center gap-2 text-[11px] font-semibold text-[var(--color-accent)]">
                    <FileText size={14} />
                    <span className="truncate">{m.fileName ?? m.attachments?.[0]?.fileName}</span>
                    {m.fileSize && <span className="text-[10px] text-[var(--color-text-tertiary)] ml-auto">{m.fileSize}</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      {!isReadOnly && (
        <form onSubmit={handleSend} className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col gap-2">
          {attachment && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 font-medium">
              <CheckCircle2 size={13} /> Attached: {attachment.fileName} ({attachment.fileSize})
              <button type="button" onClick={() => setAttachment(null)} className="ml-auto text-[10px] text-emerald-800 hover:underline">Remove</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateAttachment}
              className="p-2 rounded-xl hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors"
              title="Attach File"
            >
              <Paperclip size={16} />
            </button>
            <input
              type="text"
              placeholder="Type your message or blocker update…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input flex-1 py-2 text-xs bg-[var(--color-surface)] border-[var(--color-border)]"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="btn-primary py-2 px-3 text-xs whitespace-nowrap"
            >
              <Send size={13} /> {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
