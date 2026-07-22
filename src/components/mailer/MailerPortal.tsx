"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Mail, Upload, RefreshCw, AlertCircle, FileText,
  Play, History, Loader2, ArrowRight, Eye, Send, Check, Info, Paperclip, X, File
} from "lucide-react";
import { parseCSV, detectColumns } from "@/lib/mailer/csv";
import { fillTpl, TEMPLATE_VARIABLES } from "@/lib/mailer/template";
import { DelegateMatch, Draft, FolderConfig, SendPayload, CustomAttachment } from "@/lib/mailer/types";

interface MailerPortalProps {
  enabled: boolean;
  mode: string;
  webAppUrl: string;
}

export default function MailerPortal({ enabled, mode, webAppUrl }: MailerPortalProps) {
  const [activeTab, setActiveTab] = useState<"import" | "send" | "log">("import");
  const [folderConfig, setFolderConfig] = useState<FolderConfig | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // CSV State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [detectedCols, setDetectedCols] = useState<Record<string, string>>({});

  // Matching State
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState<DelegateMatch[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Record<number, boolean>>({});
  const [docToggles, setDocToggles] = useState({
    letter: true,
    card: true,
    itinerary: true,
    voucher: true
  });
  const [matchFilter, setMatchFilter] = useState<"all" | "complete" | "incomplete" | "no_email" | "no_letter" | "no_card" | "no_itinerary" | "no_voucher">("all");

  // Drafts & Send State
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [draftCC, setDraftCC] = useState("");
  const [draftBCC, setDraftBCC] = useState("");
  const [subjectOverride, setSubjectOverride] = useState("");
  const [htmlBodyOverride, setHtmlBodyOverride] = useState("");

  // Custom Attachments State
  const [customAttachments, setCustomAttachments] = useState<CustomAttachment[]>([]);
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const attachFileInputRef = useRef<HTMLInputElement>(null);

  // Sending progress
  const [sending, setSending] = useState(false);
  const [sendLogs, setSendLogs] = useState<{ name: string; email: string; status: "pending" | "success" | "error"; error?: string }[]>([]);
  const [sendProgress, setSendProgress] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  // Send history log
  interface MailHistoryRow {
    sentOn?: string;
    timestamp?: string;
    recipient?: string;
    email?: string;
    subject?: string;
    draft?: string;
    letter?: boolean;
    card?: boolean;
    itinerary?: boolean;
    voucher?: boolean;
    sentByName?: string;
    sentByEmail?: string;
    status?: string;
    error?: string;
  }


  const [historyLogs, setHistoryLogs] = useState<MailHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Setup sheet url
  const [sheetUrl, setSheetUrl] = useState("");

  // Load Folder Configuration, Drafts, and Log
  const loadFolderConfig = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/mailer/getFolderConfig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: [] }),
      });
      const data = await res.json();
      if (data.success || data.folders) {
        setFolderConfig(data);
      } else {
        toast.error("Failed to load mailer folder settings: " + (data.error || "Unknown"));
      }
    } catch {
      toast.error("Failed to fetch folder config.");
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await fetch("/api/mailer/getDrafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: [] }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.result)) {
        setDrafts(data.result);
      }
    } catch {
      console.error("Failed to load drafts.");
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  const loadHistoryLogs = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/mailer/getSendLog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: [] }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.result)) {
        setHistoryLogs(data.result);
      }
    } catch {
      console.error("Failed to load send logs.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadSheetUrl = useCallback(async () => {
    try {
      const res = await fetch("/api/mailer/getSheetUrl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: [] }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setSheetUrl(data.result);
      }
    } catch { }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (enabled && mode === "api") {
        loadFolderConfig();
        loadDrafts();
        loadHistoryLogs();
        loadSheetUrl();
      }
    });
  }, [enabled, mode, loadFolderConfig, loadDrafts, loadHistoryLogs, loadSheetUrl]);

  // File Upload Handling
  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const text = await file.text();
    const data = parseCSV(text);
    setCsvData(data);
    const cols = detectColumns(data.headers);
    setDetectedCols(cols);
    setMatches([]);
    setSelectedMatches({});
    toast.success(`Loaded CSV with ${data.rows.length} rows`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      setCsvFile(file);
      const text = await file.text();
      const data = parseCSV(text);
      setCsvData(data);
      const cols = detectColumns(data.headers);
      setDetectedCols(cols);
      setMatches([]);
      setSelectedMatches({});
      toast.success(`Loaded CSV with ${data.rows.length} rows`);
    } else {
      toast.error("Please drop a valid .csv file");
    }
  };

  // Run Matching
  const runMatching = async () => {
    if (!csvData) return;
    setMatching(true);
    try {
      // Map rows based on detected columns to the structure the App Script matcher expects
      const formatted = csvData.rows.map((r, i) => {
        const getMapped = (key: string) => {
          const colHeader = detectedCols[key];
          return colHeader ? r[colHeader] : "";
        };

        return {
          title: getMapped("title"),
          first_name: getMapped("first_name"),
          last_name: getMapped("last_name"),
          full_name: getMapped("full_name") || [getMapped("title"), getMapped("first_name"), getMapped("last_name")].filter(Boolean).join(" "),
          participant_email: getMapped("email"),
          passport_country: getMapped("citizenship"),
          country_name: getMapped("country"),
          company_name: getMapped("company"),
          designation: getMapped("designation"),
          region: getMapped("region"),
          participant_mobile: getMapped("mobile"),
          passport_number: getMapped("passport_number"),
          place_of_issue: getMapped("place_of_issue"),
          date_of_expiry: getMapped("date_of_expiry"),
          poc: getMapped("poc"),
          rowIndex: i
        };
      });

      const res = await fetch("/api/mailer/matchDelegates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: [formatted] }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.result)) {
        setMatches(data.result);

        // Auto-select "Ready" delegates (has email + at least one matched doc)
        const initialSelected: Record<number, boolean> = {};
        data.result.forEach((m: DelegateMatch) => {
          const hasAtLeastOneDoc = m.hasLetter || m.hasCard || m.hasItinerary || m.hasVoucher;
          if (m.hasEmail && hasAtLeastOneDoc) {
            initialSelected[m.rowIndex] = true;
          }
        });
        setSelectedMatches(initialSelected);
        toast.success(`Matched ${data.result.length} delegates`);
      } else {
        toast.error("Matching failed: " + (data.error || "Check script configuration"));
      }
    } catch {
      toast.error("Failed to run matching request.");
    } finally {
      setMatching(false);
    }
  };

  // Re-match single delegate
  const rematchDelegate = async (m: DelegateMatch) => {
    try {
      const res = await fetch("/api/mailer/rematchOne", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: [m] }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setMatches(prev => prev.map(item => item.rowIndex === m.rowIndex ? data.result : item));
        toast.success(`Re-matched ${m.fullName}`);
      } else {
        toast.error("Re-matching failed");
      }
    } catch {
      toast.error("Request failed");
    }
  };

  // Connection Index Setup
  const runBuildIndex = async () => {
    const tid = toast.loading("Building Google Drive PDF index (this may take a few minutes)...");
    try {
      const res = await fetch("/api/mailer/buildIndex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: [] }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("✅ File index rebuilt successfully!", { id: tid });
        loadFolderConfig();
      } else {
        toast.error("Build index failed: " + data.error, { id: tid });
      }
    } catch {
      toast.error("Build index request failed.", { id: tid });
    }
  };

  // Load selected draft details
  useEffect(() => {
    Promise.resolve().then(() => {
      if (!selectedDraftId) {
        setDraftCC("");
        setDraftBCC("");
        setSubjectOverride("");
        setHtmlBodyOverride("");
        return;
      }
      const d = drafts.find(x => x.id === selectedDraftId);
      if (d) {
        setDraftCC(d.cc || "");
        setDraftBCC(d.bcc || "");
        setSubjectOverride(d.subject || "");
        setHtmlBodyOverride(d.htmlBody || "");
      }
    });
  }, [selectedDraftId, drafts]);

  // Filters and stats
  const filteredMatches = matches.filter(m => {
    const hasAllDocs = (!folderConfig?.folders?.letter || m.hasLetter) &&
      (!folderConfig?.folders?.card || m.hasCard) &&
      (!folderConfig?.folders?.itinerary || m.hasItinerary) &&
      (!folderConfig?.folders?.voucher || m.hasVoucher);

    if (matchFilter === "complete") return m.hasEmail && hasAllDocs;
    if (matchFilter === "incomplete") return !hasAllDocs;
    if (matchFilter === "no_email") return !m.hasEmail;
    if (matchFilter === "no_letter") return !m.hasLetter;
    if (matchFilter === "no_card") return !m.hasCard;
    if (matchFilter === "no_itinerary") return !m.hasItinerary;
    if (matchFilter === "no_voucher") return !m.hasVoucher;
    return true;
  });

  const totalSelected = Object.values(selectedMatches).filter(Boolean).length;

  const handleSelectAll = () => {
    const next: Record<number, boolean> = {};
    filteredMatches.forEach(m => { next[m.rowIndex] = true; });
    setSelectedMatches(prev => ({ ...prev, ...next }));
  };

  const handleSelectNone = () => {
    setSelectedMatches({});
  };

  const handleSelectReady = () => {
    const next: Record<number, boolean> = {};
    filteredMatches.forEach(m => {
      const hasAtLeastOneDoc = m.hasLetter || m.hasCard || m.hasItinerary || m.hasVoucher;
      if (m.hasEmail && hasAtLeastOneDoc) {
        next[m.rowIndex] = true;
      }
    });
    setSelectedMatches(next);
  };

  // Sample data preview
  const getPreviewHtml = () => {
    if (!htmlBodyOverride || matches.length === 0) return "<p class='text-gray-400 text-center py-8'>Matches list is empty. Upload and match CSV first to preview templated variables.</p>";
    const sampleMatch = matches[0];
    const sampleFields: Record<string, string> = {
      title: sampleMatch.title || "",
      first_name: sampleMatch.firstName || sampleMatch.fullName.split(" ")[0] || "",
      last_name: sampleMatch.lastName || sampleMatch.fullName.split(" ").slice(1).join(" ") || "",
      full_name: sampleMatch.fullName || "",
      citizenship: sampleMatch.citizenship || "",
      country: sampleMatch.country || "",
      company: sampleMatch.company || "",
      designation: sampleMatch.designation || "",
      region: sampleMatch.region || "",
      email: sampleMatch.email || "",
    };
    return fillTpl(htmlBodyOverride, sampleFields);
  };

  // Custom Attachment Handlers
  const handleCustomAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoadingAttachment(true);
    try {
      for (const file of files) {
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 8MB limit — skipped`);
          continue;
        }
        const base64Data = await fileToBase64(file);
        const attachment: CustomAttachment = {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64Data,
          size: file.size
        };
        setCustomAttachments(prev => {
          // Prevent duplicates by name
          if (prev.find(a => a.fileName === file.name)) return prev;
          return [...prev, attachment];
        });
      }
      toast.success(`Attachment(s) added`);
    } catch {
      toast.error("Failed to process attachment");
    } finally {
      setLoadingAttachment(false);
      if (attachFileInputRef.current) attachFileInputRef.current.value = "";
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (data:mime;base64,)
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeCustomAttachment = (fileName: string) => {
    setCustomAttachments(prev => prev.filter(a => a.fileName !== fileName));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Throttle helper
  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Send flow execution
  const startSending = async () => {
    setShowConfirm(false);
    setSending(true);
    setSendProgress(0);

    const selectedList = matches.filter(m => selectedMatches[m.rowIndex]);
    const total = selectedList.length;
    const initialLogs = selectedList.map(m => ({ name: m.fullName, email: m.email, status: "pending" as const }));
    setSendLogs(initialLogs);

    for (let index = 0; index < total; index++) {
      const delegate = selectedList[index];
      const delegateFields: Record<string, string> = {
        title: delegate.title || "",
        first_name: delegate.firstName || delegate.fullName.split(" ")[0] || "",
        last_name: delegate.lastName || delegate.fullName.split(" ").slice(1).join(" ") || "",
        full_name: delegate.fullName || "",
        citizenship: delegate.citizenship || "",
        country: delegate.country || "",
        company: delegate.company || "",
        designation: delegate.designation || "",
        region: delegate.region || "",
        email: delegate.email || "",
      };

      // Fill templates
      const personalisedSubject = fillTpl(subjectOverride, delegateFields);
      const personalisedHtml = fillTpl(htmlBodyOverride, delegateFields);
      const personalisedPlain = fillTpl(subjectOverride, delegateFields); // or build plain text similarly

      const payload: SendPayload = {
        toEmail: delegate.email,
        recipientName: delegate.fullName,
        subject: personalisedSubject,
        htmlBody: personalisedHtml,
        plainBody: personalisedPlain,
        draftName: drafts.find(x => x.id === selectedDraftId)?.name || "Concierge Draft",
        cc: draftCC,
        bcc: draftBCC,
        sendLetter: docToggles.letter && delegate.hasLetter,
        letterFileId: delegate.letter?.fileId || "",
        sendCard: docToggles.card && delegate.hasCard,
        cardFileId: delegate.card?.fileId || "",
        sendItinerary: docToggles.itinerary && delegate.hasItinerary,
        itineraryFileId: delegate.itinerary?.fileId || "",
        sendVoucher: docToggles.voucher && delegate.hasVoucher,
        voucherFileId: delegate.voucher?.fileId || "",
        customAttachments: customAttachments.length > 0 ? customAttachments : undefined,
      };

      try {
        const res = await fetch("/api/mailer/sendOne", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ args: [payload] }),
        });
        const data = await res.json();

        setSendLogs(prev => prev.map((item, i) => {
          if (i === index) {
            return {
              ...item,
              status: data.success ? "success" as const : "error" as const,
              error: data.success ? undefined : data.error
            };
          }
          return item;
        }));

        if (!data.success) {
          console.error(`Failed to send to ${delegate.fullName}: ${data.error}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSendLogs(prev => prev.map((item, i) => {
          if (i === index) {
            return { ...item, status: "error" as const, error: message || "Request error" };
          }
          return item;
        }));
      }

      setSendProgress(Math.round(((index + 1) / total) * 100));

      // Throttle: pause 1.4 seconds after every 8 sends
      if ((index + 1) % 8 === 0 && index + 1 < total) {
        setSendLogs(prev => [...prev, { name: "SYSTEM THROTTLE", email: "Please wait...", status: "pending" }]);
        await delay(1400);
        setSendLogs(prev => prev.filter(x => x.name !== "SYSTEM THROTTLE"));
      }
    }

    toast.success("🚀 Custom concierge mailing sequence finished!");
    setSending(false);
    loadHistoryLogs();
  };

  if (!enabled) {
    return (
      <div className="p-6 md:p-8 max-w-[800px] mx-auto animate-fade-in text-center py-16">
        <div className="glass-card p-8 shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-danger-light)] flex items-center justify-center text-[var(--color-danger)] mb-6 shadow-sm">
            <Mail size={32} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] mb-2">Mailer Integration Disabled</h2>
          <p className="text-[0.95rem] font-medium text-[var(--color-text-secondary)] mb-6 max-w-[480px] mx-auto">
            The BB Concierge Mailer portal is currently disabled. Go to Settings → Integrations → Mailer to configure, verify, and enable it.
          </p>
        </div>
      </div>
    );
  }

  if (mode === "embed") {
    return (
      <div className="p-6 md:p-8 max-w-[1280px] mx-auto animate-fade-in">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] mb-1">Concierge Mailer</h1>
            <p className="text-[0.9rem] font-medium text-[var(--color-text-secondary)]">Embedded v4.0 Apps Script Portal</p>
          </div>
          {sheetUrl && (
            <a href={sheetUrl} target="_blank" rel="noreferrer" className="btn-secondary py-2 px-4 flex items-center gap-1.5 shadow-sm font-semibold">
              Open Backing Sheet <ArrowRight size={14} />
            </a>
          )}
        </div>
        <div className="glass-card overflow-hidden shadow-md">
          {webAppUrl ? (
            <iframe src={webAppUrl} className="w-full h-[82vh] rounded-xl border-0 bg-white" />
          ) : (
            <div className="p-16 text-center text-[var(--color-text-tertiary)]">
              <AlertCircle className="mx-auto mb-4" size={32} />
              <p>Google Apps Script URL is missing. Go to Settings to configure it.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-[1280px] mx-auto animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] mb-1">Concierge Mailer</h1>
          <p className="text-[0.9rem] font-medium text-[var(--color-text-secondary)]">Personalised document attachments & sending console</p>
        </div>
        <div className="flex gap-2">
          {sheetUrl && (
            <a href={sheetUrl} target="_blank" rel="noreferrer" className="btn-secondary py-2 px-4 flex items-center gap-1.5 shadow-sm font-semibold text-xs">
              Open Backing Sheet <ArrowRight size={12} />
            </a>
          )}
          <button className="btn-secondary py-2 px-4 flex items-center gap-1.5 shadow-sm font-semibold text-xs" onClick={runBuildIndex} disabled={loadingFolders}>
            <RefreshCw size={12} className={loadingFolders ? "animate-spin" : ""} /> Rebuild Drive Index
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-[var(--color-border)] mb-6 gap-2">
        <button
          onClick={() => setActiveTab("import")}
          className={`py-3 px-4 flex items-center gap-2 font-semibold text-sm border-b-2 bg-transparent border-none cursor-pointer transition-colors ${activeTab === "import"
            ? "border-[var(--color-accent)] text-[var(--color-accent)]"
            : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
        >
          <Upload size={16} /> Import &amp; Match
        </button>
        <button
          onClick={() => setActiveTab("send")}
          className={`py-3 px-4 flex items-center gap-2 font-semibold text-sm border-b-2 bg-transparent border-none cursor-pointer transition-colors ${activeTab === "send"
            ? "border-[var(--color-accent)] text-[var(--color-accent)]"
            : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          disabled={matches.length === 0}
        >
          <Mail size={16} /> Compose &amp; Send
        </button>
        <button
          onClick={() => setActiveTab("log")}
          className={`py-3 px-4 flex items-center gap-2 font-semibold text-sm border-b-2 bg-transparent border-none cursor-pointer transition-colors ${activeTab === "log"
            ? "border-[var(--color-accent)] text-[var(--color-accent)]"
            : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
        >
          <History size={16} /> Send History Logs
        </button>
      </div>

      {/* ── Tab 1: Import & Match ── */}
      {activeTab === "import" && (
        <div className="flex flex-col gap-6">
          {/* Folders Summary */}
          {folderConfig && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {([
                { type: "letter", label: "Letters", color: "bg-blue-500/10 text-blue-500" },
                { type: "card", label: "Cards", color: "bg-amber-500/10 text-amber-500" },
                { type: "itinerary", label: "Itineraries", color: "bg-green-500/10 text-green-500" },
                { type: "voucher", label: "Vouchers", color: "bg-purple-500/10 text-purple-500" },
              ] as const).map(({ type, label, color }) => {
                const isConnected = !!folderConfig.folders?.[type];
                const count = folderConfig.counts?.[type] ?? 0;
                return (
                  <div key={type} className="glass-card p-4 flex items-center gap-3 shadow-sm">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-tertiary)]">{label}</p>
                      <p className="font-bold text-[var(--color-text-primary)]">{isConnected ? `${count} Indexed` : "Disconnected"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CSV Upload Area */}
          {!csvFile ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-[var(--color-border)] rounded-2xl p-10 text-center bg-[var(--color-surface)] shadow-sm hover:border-[var(--color-accent)] transition-colors flex flex-col items-center justify-center cursor-pointer min-h-[220px]"
              onClick={() => document.getElementById("csv-file-picker")?.click()}
            >
              <input
                id="csv-file-picker"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvFileChange}
              />
              <Upload className="text-[var(--color-text-tertiary)] mb-4 animate-bounce" size={40} />
              <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-1">Drag and drop delegates CSV here</h3>
              <p className="text-sm text-[var(--color-text-tertiary)] font-medium max-w-[320px]">
                or click to browse local files. Matches columns automatically.
              </p>
            </div>
          ) : (
            <div className="glass-card p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border border-[var(--color-accent)]/20 bg-[var(--color-accent-light)]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-light)] flex items-center justify-center text-[var(--color-accent)] shadow-sm">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-[var(--color-text-primary)]">{csvFile.name}</h4>
                  <p className="text-xs text-[var(--color-text-tertiary)] font-medium">{(csvFile.size / 1024).toFixed(1)} KB · {csvData?.rows.length ?? 0} rows found</p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button className="btn-secondary py-2 px-4 flex-1 sm:flex-none" onClick={() => { setCsvFile(null); setCsvData(null); setMatches([]); }}>
                  Clear
                </button>
                <button className="btn-primary py-2 px-6 flex-1 sm:flex-none font-bold shadow-sm" onClick={runMatching} disabled={matching}>
                  {matching ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />} {matching ? "Matching..." : "Run Matching Engine"}
                </button>
              </div>
            </div>
          )}

          {/* Match Table */}
          {matches.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-[var(--color-border)] pb-4">
                {/* Stats */}
                <div className="flex items-center gap-4 flex-wrap text-xs font-semibold text-[var(--color-text-secondary)]">
                  <span>Total: <strong>{matches.length}</strong></span>
                  <span>Complete: <strong>{matches.filter(m => m.hasLetter && m.hasCard && m.hasItinerary && m.hasVoucher).length}</strong></span>
                  <span>Selected: <strong>{totalSelected}</strong></span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="btn-secondary py-1 px-3 text-xs" onClick={handleSelectAll}>Select All</button>
                  <button className="btn-secondary py-1 px-3 text-xs" onClick={handleSelectReady}>Select Ready</button>
                  <button className="btn-secondary py-1 px-3 text-xs" onClick={handleSelectNone}>Clear Selection</button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap mb-2">
                {([
                  { value: "all", label: "All Records" },
                  { value: "complete", label: "Complete Matches" },
                  { value: "incomplete", label: "Incomplete Matches" },
                  { value: "no_email", label: "Missing Email" },
                  { value: "no_letter", label: "No Letter" },
                  { value: "no_card", label: "No Card" },
                  { value: "no_itinerary", label: "No Itinerary" },
                  { value: "no_voucher", label: "No Voucher" },
                ] as const).map(f => (
                  <button
                    key={f.value}
                    onClick={() => setMatchFilter(f.value)}
                    className={`py-1.5 px-3 rounded-full text-xs font-semibold border transition-all cursor-pointer ${matchFilter === f.value
                      ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-sm"
                      : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)]"
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Table Container */}
              <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)] shadow-sm">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }} className="text-center">Select</th>
                      <th>Name / Email</th>
                      <th>Country / Citizenship</th>
                      <th className="text-center">Letter</th>
                      <th className="text-center">Card</th>
                      <th className="text-center">Itin</th>
                      <th className="text-center">Voucher</th>
                      <th>Confidence</th>
                      <th style={{ width: 80 }} className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatches.map(m => {
                      const isSelected = !!selectedMatches[m.rowIndex];
                      return (
                        <tr key={m.rowIndex} className={isSelected ? "bg-[var(--color-accent-light)]/10" : ""}>
                          <td className="text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 cursor-pointer"
                              checked={isSelected}
                              onChange={e => setSelectedMatches(prev => ({ ...prev, [m.rowIndex]: e.target.checked }))}
                            />
                          </td>
                          <td>
                            <div className="font-semibold text-[var(--color-text-primary)]">{m.fullName}</div>
                            {m.hasEmail ? (
                              <code className="text-xs text-[var(--color-text-secondary)]">{m.email}</code>
                            ) : (
                              <span className="text-xs text-[var(--color-danger)] font-medium">Missing email</span>
                            )}
                          </td>
                          <td className="text-xs text-[var(--color-text-secondary)] font-medium">
                            <div>Lives: {m.country || "—"}</div>
                            <div>Passport: {m.citizenship || "—"}</div>
                          </td>
                          <td className="text-center">
                            {m.hasLetter ? (
                              <span className="text-[var(--color-success)]" title={m.letter?.fileName}>✓</span>
                            ) : (
                              <span className="text-[var(--color-text-tertiary)]">✗</span>
                            )}
                          </td>
                          <td className="text-center">
                            {m.hasCard ? (
                              <span className="text-[var(--color-success)]" title={m.card?.fileName}>✓</span>
                            ) : (
                              <span className="text-[var(--color-text-tertiary)]">✗</span>
                            )}
                          </td>
                          <td className="text-center">
                            {m.hasItinerary ? (
                              <span className="text-[var(--color-success)]" title={m.itinerary?.fileName}>✓</span>
                            ) : (
                              <span className="text-[var(--color-text-tertiary)]">✗</span>
                            )}
                          </td>
                          <td className="text-center">
                            {m.hasVoucher ? (
                              <span className="text-[var(--color-success)]" title={m.voucher?.fileName}>✓</span>
                            ) : (
                              <span className="text-[var(--color-text-tertiary)]">✗</span>
                            )}
                          </td>
                          <td>
                            <span className={`inline-flex px-2 py-0.5 rounded text-[0.7rem] font-bold uppercase ${m.confidence === "exact"
                              ? "bg-green-500/10 text-green-600"
                              : m.confidence === "fuzzy" || m.confidence === "name"
                                ? "bg-blue-500/10 text-blue-600"
                                : "bg-amber-500/10 text-amber-600"
                              }`}>
                              {m.confidence}
                            </span>
                          </td>
                          <td className="text-center">
                            <button className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)] cursor-pointer" title="Re-match" onClick={() => rematchDelegate(m)}>
                              <RefreshCw size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  className="btn-primary py-2.5 px-6 font-bold shadow-md"
                  onClick={() => setActiveTab("send")}
                  disabled={totalSelected === 0}
                >
                  Configure Email Content &amp; Send <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Compose & Send ── */}
      {activeTab === "send" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Compose Panel */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="glass-card p-5 shadow-sm flex flex-col gap-4">
              <h3 className="font-bold text-base text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-2">1. Choose Draft Template</h3>

              <div>
                <label className="label">Draft Picker</label>
                <select
                  className="input"
                  value={selectedDraftId}
                  onChange={e => setSelectedDraftId(e.target.value)}
                  disabled={loadingDrafts}
                >
                  <option value="">{loadingDrafts ? "Loading templates..." : "-- Select template --"}</option>
                  {drafts.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">CC</label>
                  <input
                    type="text"
                    className="input text-xs"
                    value={draftCC}
                    onChange={e => setDraftCC(e.target.value)}
                    placeholder="cc@company.com"
                  />
                </div>
                <div>
                  <label className="label">BCC</label>
                  <input
                    type="text"
                    className="input text-xs"
                    value={draftBCC}
                    onChange={e => setDraftBCC(e.target.value)}
                    placeholder="bcc@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="label">Subject Line</label>
                <input
                  type="text"
                  className="input text-xs font-semibold"
                  value={subjectOverride}
                  onChange={e => setSubjectOverride(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Email Body (HTML Template)</label>
                <textarea
                  className="input font-mono text-xs"
                  style={{ height: 260, resize: "vertical" }}
                  value={htmlBodyOverride}
                  onChange={e => setHtmlBodyOverride(e.target.value)}
                />
                <p className="text-[0.7rem] text-[var(--color-text-tertiary)] mt-1 text-right">Length: {htmlBodyOverride.length} / 48,000 chars</p>
              </div>
            </div>

            {/* Document Send Toggles */}
            <div className="glass-card p-5 shadow-sm flex flex-col gap-3">
              <h3 className="font-bold text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">2. Drive Document Attachments</h3>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { type: "letter", label: "Letter" },
                  { type: "card", label: "Card" },
                  { type: "itinerary", label: "Itinerary" },
                  { type: "voucher", label: "Hotel Voucher" },
                ] as const).map(({ type, label }) => {
                  const hasFolder = !!folderConfig?.folders?.[type];
                  return (
                    <label key={type} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${hasFolder ? "border-[var(--color-border)] hover:border-[var(--color-accent)]" : "opacity-40 bg-[var(--color-bg-primary)] border-transparent cursor-not-allowed"
                      }`}>
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        disabled={!hasFolder || sending}
                        checked={docToggles[type]}
                        onChange={e => setDocToggles(prev => ({ ...prev, [type]: e.target.checked }))}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom File Attachments */}
            <div className="glass-card p-5 shadow-sm flex flex-col gap-3">
              <h3 className="font-bold text-xs text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip size={13} /> 3. Custom Attachments <span className="text-[var(--color-text-tertiary)] font-normal normal-case">(PDF, images, docs — max 8MB each)</span>
              </h3>

              {/* Uploaded custom attachments */}
              {customAttachments.length > 0 && (
                <div className="flex flex-col gap-2">
                  {customAttachments.map(att => (
                    <div key={att.fileName} className="flex items-center justify-between p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <File size={13} className="shrink-0 text-[var(--color-accent)]" />
                        <span className="font-semibold text-[var(--color-text-primary)] truncate">{att.fileName}</span>
                        <span className="text-[var(--color-text-tertiary)] shrink-0">{formatFileSize(att.size)}</span>
                      </div>
                      <button
                        className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] transition-colors cursor-pointer shrink-0 ml-2"
                        onClick={() => removeCustomAttachment(att.fileName)}
                        title="Remove attachment"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <input
                  ref={attachFileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
                  className="hidden"
                  onChange={handleCustomAttachmentChange}
                  disabled={sending || loadingAttachment}
                />
                <button
                  className="btn-secondary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 w-full justify-center"
                  onClick={() => attachFileInputRef.current?.click()}
                  disabled={sending || loadingAttachment}
                >
                  {loadingAttachment ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                  {loadingAttachment ? "Processing..." : "Attach Files"}
                </button>
                {customAttachments.length > 0 && (
                  <p className="text-[0.68rem] text-center text-[var(--color-text-tertiary)] mt-1">
                    {customAttachments.length} custom file{customAttachments.length !== 1 ? "s" : ""} will be sent to all {totalSelected} selected delegate{totalSelected !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Template Variables Helper */}
            <div className="glass-card p-4 shadow-sm text-xs border border-[var(--color-border)]/50 bg-[var(--color-bg-primary)]/40">
              <h4 className="font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5"><Info size={13} className="text-[var(--color-accent)]" /> Available Variables</h4>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--color-text-secondary)] max-h-[140px] overflow-y-auto pr-1">
                {TEMPLATE_VARIABLES.map(v => (
                  <div key={v.placeholder} className="py-0.5 border-b border-[var(--color-border)]/20">
                    <code className="font-mono text-[var(--color-accent)] font-semibold">{v.placeholder}</code>
                    <span className="text-[10px] text-[var(--color-text-tertiary)] block">{v.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Send Actions */}
            <div className="flex gap-2">
              <button
                className="btn-primary py-3 px-8 flex-1 justify-center font-bold text-base shadow-md"
                onClick={() => setShowConfirm(true)}
                disabled={sending || !selectedDraftId || totalSelected === 0}
              >
                <Send size={16} /> Execute Send Sequence ({totalSelected})
              </button>
            </div>
          </div>

          {/* Right Live Preview & Progress Panel */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Sending Console / Progress Log */}
            {sending && (
              <div className="glass-card p-5 shadow-sm border border-[var(--color-accent)]/20 bg-black text-green-400 font-mono text-xs rounded-xl flex flex-col gap-4">
                <div className="flex justify-between items-center text-white font-sans font-semibold border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin text-[var(--color-accent)]" size={16} />
                    <span>Mailing Engine Console</span>
                  </div>
                  <span>{sendProgress}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-[var(--color-accent)] h-full transition-all duration-300" style={{ width: `${sendProgress}%` }} />
                </div>

                {/* Log screen */}
                <div className="h-[300px] overflow-y-auto pr-2 flex flex-col gap-1 select-text scrollbar-thin scrollbar-thumb-white/10">
                  {sendLogs.slice(-20).map((l, i) => (
                    <div key={i} className={`py-0.5 ${l.status === "success" ? "text-green-300" : l.status === "error" ? "text-red-400" : "text-amber-300 animate-pulse"
                      }`}>
                      [{new Date().toLocaleTimeString()}] {l.status === "success" ? "✓ SUCCESS" : l.status === "error" ? `✗ FAILED: ${l.error}` : "⏳ SENDING"} → {l.name} ({l.email})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HTML Preview Iframe */}
            {!sending && (
              <div className="glass-card p-5 shadow-sm flex flex-col gap-3 h-full min-h-[500px]">
                <h3 className="font-bold text-xs text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1.5"><Eye size={14} /> Client Template Preview</h3>
                <div className="border border-[var(--color-border)] rounded-xl flex-1 bg-white overflow-hidden shadow-inner">
                  <iframe
                    title="Live Email HTML Preview"
                    sandbox="allow-same-origin"
                    srcDoc={getPreviewHtml()}
                    className="w-full h-full min-h-[460px] border-0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Dialog Modal */}
          {showConfirm && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-card-elevated w-full max-w-[480px] p-6 animate-scale-in">
                <div className="flex items-center gap-3 text-[var(--color-accent)] mb-4">
                  <Mail size={24} />
                  <h3 className="font-bold text-lg text-[var(--color-text-primary)]">Confirm Mail Blast</h3>
                </div>
                <div className="text-sm text-[var(--color-text-secondary)] flex flex-col gap-3 mb-6">
                  <p>You are about to launch a concierge mailing blast to **{totalSelected}** selected delegates.</p>
                  <div className="bg-[var(--color-bg-primary)] p-4 rounded-xl border border-[var(--color-border)] space-y-1 text-xs">
                    <div>Draft: <strong className="text-[var(--color-text-primary)]">{drafts.find(x => x.id === selectedDraftId)?.name}</strong></div>
                    <div>CC / BCC: <strong className="text-[var(--color-text-primary)]">{draftCC || "None"} / {draftBCC || "None"}</strong></div>
                    <div className="pt-2 border-t border-[var(--color-border)] mt-2">
                      Attachments Enabled:
                      <ul className="list-disc pl-5 mt-1 font-semibold text-[var(--color-text-primary)]">
                        {docToggles.letter && <li>Invitation Letters (Drive)</li>}
                        {docToggles.card && <li>Invitation Cards (Drive)</li>}
                        {docToggles.itinerary && <li>Travel Itineraries (Drive)</li>}
                        {docToggles.voucher && <li>Hotel Vouchers (Drive)</li>}
                        {customAttachments.map(a => <li key={a.fileName}>📎 {a.fileName} ({formatFileSize(a.size)})</li>)}
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)] italic">This action is irreversible. Emails will be sent directly via your Gmail Account.</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1 justify-center py-2.5 font-bold shadow-md" onClick={startSending}>
                    Confirm &amp; Blast Emails
                  </button>
                  <button className="btn-secondary py-2.5 px-5" onClick={() => setShowConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: History Log ── */}
      {activeTab === "log" && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Showing latest 200 mail logs from sheet</span>
            <button className="btn-secondary py-1 px-3 text-xs" onClick={loadHistoryLogs} disabled={loadingHistory}>
              <RefreshCw size={12} className={loadingHistory ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-surface)] shadow-sm">
            {loadingHistory ? (
              <div className="p-8 text-center text-[var(--color-text-tertiary)] flex justify-center items-center gap-2"><RefreshCw size={16} className="animate-spin" /> Fetching send log...</div>
            ) : historyLogs.length === 0 ? (
              <div className="p-8 text-center text-[var(--color-text-tertiary)] font-medium">No send logs recorded yet.</div>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Sent On</th>
                      <th>Recipient</th>
                      <th>Subject</th>
                      <th>Sent By (Sender)</th>
                      <th>Draft</th>
                      <th className="text-center">Attachments</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLogs.map((l, i) => (
                      <tr key={i}>
                        <td className="text-xs text-[var(--color-text-tertiary)] font-medium">{l.sentOn || l.timestamp || "—"}</td>
                        <td>
                          <div className="font-semibold text-xs">{l.recipient || "—"}</div>
                          <code className="text-[10px] text-[var(--color-text-secondary)]">{l.email}</code>
                        </td>
                        <td className="text-xs font-medium max-w-[200px] truncate" title={l.subject}>{l.subject}</td>
                        <td>
                          <div className="font-bold text-xs text-[var(--color-accent)]">{l.sentByName || "System"}</div>
                          {l.sentByEmail && <code className="text-[10px] text-[var(--color-text-tertiary)]">{l.sentByEmail}</code>}
                        </td>
                        <td className="text-xs text-[var(--color-text-secondary)]">{l.draft || "—"}</td>
                        <td className="text-center text-xs">
                          <span className="inline-flex gap-1">
                            {l.letter && <span title="Letter">📄</span>}
                            {l.card && <span title="Card">🏆</span>}
                            {l.itinerary && <span title="Itinerary">🗺</span>}
                            {l.voucher && <span title="Voucher">🏨</span>}
                          </span>
                        </td>
                        <td>
                          {l.status === "success" || !l.error ? (
                            <span className="inline-flex items-center gap-1 text-[var(--color-success)] text-xs font-bold bg-[var(--color-success-light)] px-2 py-0.5 rounded">
                              <Check size={12} /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[var(--color-danger)] text-xs font-bold bg-[var(--color-danger-light)] px-2 py-0.5 rounded" title={l.error}>
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
