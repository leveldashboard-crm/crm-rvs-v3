"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import {
  Send, User as UserIcon, Shield, Loader2, MessageSquare, Paperclip,
  MoreVertical, Edit2, Trash2, X, File as FileIcon, Plus, Search, Users
} from "lucide-react";

import { toast } from "sonner";
import { uploadFileToDrive } from "@/lib/gas-client";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ChatMessage {
  id: number;
  message: string;
  createdAt: string;
  userId: number;
  recipientId: number | null;
  fileUrl: string | null;
  fileName: string | null;
  isEdited: boolean;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
}

interface User {
  id: number;
  name: string | null;
  email: string;
  role: string;
}

interface ChatGroup {
  id: number;
  name: string;
  description: string | null;
  memberIds: number[] | null;
  createdByName?: string | null;
}

interface ChatPageProps {
  currentUserEmail: string | null;
  currentUserId: string | null;
  currentUserName: string | null;
  currentUserRole: string | null;
}

export default function ChatPage({
  currentUserEmail,
  currentUserId,
  currentUserName,
  currentUserRole,
}: ChatPageProps) {
  // activeTab: "team" | "dm" | "group"
  const [activeTab, setActiveTab] = useState<"team" | "dm" | "group">("team");
  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // Create Group form states
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Fetch Users
  const { data: usersData } = useSWR<{ users: User[]; currentUserId?: number }>("/api/chat/users", fetcher);
  const usersList = useMemo(() => usersData?.users || [], [usersData]);

  const myUserId = useMemo(() => {
    if (usersData?.currentUserId) return usersData.currentUserId;
    const found = usersList.find((u) => u.email === currentUserEmail);
    if (found) return found.id;
    const num = parseInt(String(currentUserId), 10);
    return isNaN(num) ? 1 : num;
  }, [usersData, usersList, currentUserEmail, currentUserId]);

  const isAdmin = currentUserRole === "master_admin" || currentUserRole === "admin" || currentUserId === "admin";


  // Fetch Groups
  const { data: groupsData, mutate: mutateGroups } = useSWR<{ groups: ChatGroup[] }>(
    "/api/v1/chat/groups",
    fetcher
  );
  const groupsList = useMemo(() => groupsData?.groups || [], [groupsData]);

  // Determine query URL based on active view
  let apiUrl = "/api/chat";
  if (activeTab === "dm" && recipientId) {
    apiUrl = `/api/chat?recipientId=${recipientId}`;
  } else if (activeTab === "group" && activeGroupId) {
    apiUrl = `/api/v1/chat?threadType=group&threadId=${activeGroupId}`;
  }

  const { data, mutate, isLoading } = useSWR<{ messages: ChatMessage[] }>(
    apiUrl,
    fetcher,
    { refreshInterval: 3000 }
  );

  const messages = useMemo(() => data?.messages ?? [], [data]);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return usersList;
    const q = userSearch.toLowerCase();
    return usersList.filter(
      (u) => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.role || "").toLowerCase().includes(q)
    );
  }, [usersList, userSearch]);


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !file) return;

    setSending(true);

    let uploadedUrl = null;
    let uploadedName = null;

    if (file) {
      try {
        const res = await uploadFileToDrive(file, {
          subFolderName: "Chat Attachments",
          docType: "chat_attachment",
        });
        if (res.ok) {
          uploadedUrl = res.url || res.webViewLink || null;
          uploadedName = file.name;
        } else {
          toast.error("Failed to upload attachment");
          setSending(false);
          return;
        }
      } catch {
        toast.error("Network error during upload");
        setSending(false);
        return;
      }
    }

    const optimisticMessage: ChatMessage = {
      id: Date.now(),
      message: newMessage.trim(),
      createdAt: new Date().toISOString(),
      userId: myUserId,
      recipientId: activeTab === "dm" ? recipientId : null,
      fileUrl: uploadedUrl,
      fileName: uploadedName,
      isEdited: false,
      userName: currentUserName || "You",
      userEmail: currentUserEmail || "",
      userRole: currentUserRole || "user",
    };

    mutate({ messages: [...messages, optimisticMessage] }, false);
    setNewMessage("");
    setFile(null);

    try {
      if (activeTab === "group" && activeGroupId) {
        await fetch("/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadType: "group",
            threadId: String(activeGroupId),
            message: optimisticMessage.message,
            fileUrl: optimisticMessage.fileUrl,
            fileName: optimisticMessage.fileName,
          }),
        });
      } else {
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: optimisticMessage.message,
            recipientId: optimisticMessage.recipientId,
            fileUrl: optimisticMessage.fileUrl,
            fileName: optimisticMessage.fileName,
          }),
        });
      }
      mutate();
    } catch {
      toast.error("Network error");
      mutate();
    } finally {
      setSending(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setCreatingGroup(true);
    try {
      const res = await fetch("/api/v1/chat/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim() || null,
          memberIds: selectedMemberIds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Group "${groupName}" created!`);
        setShowCreateGroupModal(false);
        setGroupName("");
        setGroupDesc("");
        setSelectedMemberIds([]);
        mutateGroups();

        if (data.group?.id) {
          setActiveTab("group");
          setActiveGroupId(data.group.id);
        }
      } else {
        toast.error("Failed to create group");
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleToggleMember = (userId: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const activeHeaderTitle = useMemo(() => {
    if (activeTab === "team") return "Global Team Chat";
    if (activeTab === "dm" && recipientId) {
      const u = usersList.find((x) => x.id === recipientId);
      return u ? `${u.name || u.email} (${u.role})` : "Direct Message";
    }
    if (activeTab === "group" && activeGroupId) {
      const g = groupsList.find((x) => x.id === activeGroupId);
      return g ? `Group: ${g.name}` : "Group Channel";
    }
    return "Enterprise Messaging";
  }, [activeTab, recipientId, activeGroupId, usersList, groupsList]);

  return (
    <div className="flex h-[calc(100vh-80px)] max-w-[1400px] mx-auto animate-fade-in p-4 md:p-6 gap-6">
      {/* ── Sidebar ── */}
      <div className="w-[320px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-sm flex flex-col overflow-hidden hidden md:flex shrink-0">
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] flex items-center justify-between">
          <h2 className="font-bold text-base text-[var(--color-text-primary)]">Enterprise Chat</h2>
          <button
            onClick={() => setShowCreateGroupModal(true)}
            className="btn-primary py-1 px-2.5 text-[11px] flex items-center gap-1 shadow-xs"
            title="Create New Group Channel"
          >
            <Plus size={13} /> New Group
          </button>
        </div>

        {/* User Search Bar */}
        <div className="p-3 border-b border-[var(--color-border)]/60 bg-[var(--color-surface)]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              type="text"
              placeholder="Search team members or roles…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="input w-full pl-9 py-1.5 text-xs bg-[var(--color-bg-primary)] border-[var(--color-border)]"
            />
          </div>
        </div>

        {/* Channels & DMs List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
          {/* Main Team Channel */}
          <div>
            <div className="px-3 pb-1 text-[0.68rem] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Main Channel
            </div>
            <div
              onClick={() => {
                setActiveTab("team");
                setRecipientId(null);
                setActiveGroupId(null);
              }}
              className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                activeTab === "team" ? "bg-[var(--color-accent)] text-white shadow-sm font-semibold" : "hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeTab === "team" ? "bg-white/20" : "bg-[#0071e3]/10 text-[#0071e3]"}`}>
                <MessageSquare size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate font-bold">Global Team Chat</div>
                <div className="text-[10px] opacity-75 truncate">All enterprise team members</div>
              </div>
            </div>
          </div>

          {/* Group Channels Section */}
          {groupsList.length > 0 && (
            <div>
              <div className="px-3 pb-1 text-[0.68rem] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider flex items-center justify-between">
                <span>Group Channels ({groupsList.length})</span>
              </div>
              <div className="space-y-1">
                {groupsList.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => {
                      setActiveTab("group");
                      setActiveGroupId(g.id);
                      setRecipientId(null);
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                      activeTab === "group" && activeGroupId === g.id
                        ? "bg-[#5856d6] text-white shadow-sm font-semibold"
                        : "hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === "group" && activeGroupId === g.id ? "bg-white/20" : "bg-[#5856d6]/10 text-[#5856d6]"}`}>
                      <Users size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate font-bold">{g.name}</div>
                      <div className="text-[10px] opacity-75 truncate">{g.description || `${g.memberIds?.length ?? 0} members`}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Messages Section */}
          <div>
            <div className="px-3 pb-1 text-[0.68rem] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Direct Messages ({filteredUsers.length})
            </div>
            <div className="space-y-1">
              {filteredUsers
                .filter((u) => u.id !== myUserId)
                .map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      setActiveTab("dm");
                      setRecipientId(u.id);
                      setActiveGroupId(null);
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                      activeTab === "dm" && recipientId === u.id
                        ? "bg-[var(--color-accent)] text-white shadow-sm font-semibold"
                        : "hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${activeTab === "dm" && recipientId === u.id ? "bg-white/20" : "bg-gradient-to-tr from-[#0071e3] to-[#5856d6] text-white"}`}>
                      {(u.name || u.email)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate font-bold">{u.name || u.email}</div>
                      <div className="text-[10px] opacity-75 truncate capitalize">{u.role?.replace("_", " ")}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Chat Messaging Area ── */}
      <div className="flex-1 flex flex-col bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl shadow-sm overflow-hidden relative">
        {/* Header */}
        <div className="px-6 py-3.5 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between shadow-xs z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0071e3] to-[#5856d6] flex items-center justify-center text-white shadow-xs">
              {activeTab === "group" ? <Users size={18} /> : activeTab === "dm" ? <UserIcon size={18} /> : <MessageSquare size={18} />}
            </div>
            <div>
              <h2 className="font-bold text-sm text-[var(--color-text-primary)] leading-tight">{activeHeaderTitle}</h2>
              <p className="text-[11px] text-[var(--color-text-secondary)] font-medium">
                {activeTab === "dm" ? "Direct encrypted messaging" : activeTab === "group" ? "Dedicated Group Channel" : "Enterprise Real-time Team Communication"}
              </p>
            </div>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-[#efeae2] dark:bg-[#0b141a]">
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 gap-2 bg-white/80 dark:bg-black/50 p-3 rounded-full w-fit mx-auto shadow-sm text-xs font-medium">
              <Loader2 className="animate-spin" size={16} /> Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="bg-white/80 dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] px-4 py-2 rounded-xl text-xs shadow-sm font-medium border border-[var(--color-border)]">
                No messages in this thread yet. Send a message to start!
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.userId === myUserId;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} items-end`}>
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-bold shadow-xs ${isMe ? "bg-[#0071e3]" : "bg-gradient-to-br from-[#5856d6] to-[#7c3aed]"}`}>
                    {(msg.userName || msg.userEmail)?.[0]?.toUpperCase() || <UserIcon size={12} />}
                  </div>

                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[80%] relative group`}>
                    {!isMe && (
                      <span className="text-[10px] font-bold text-[var(--color-accent)] mb-0.5 ml-1">
                        {msg.userName || msg.userEmail}
                      </span>
                    )}

                    <div className={`relative px-3.5 py-2 text-xs rounded-2xl shadow-xs flex flex-col ${
                      isMe
                        ? "bg-[#0071e3] text-white rounded-tr-none"
                        : "bg-white text-[var(--color-text-primary)] rounded-tl-none border border-[var(--color-border)]"
                    }`}>
                      {msg.fileUrl && (
                        <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-black/10 rounded-lg mb-1 hover:bg-black/20 transition-colors">
                          <FileIcon size={14} />
                          <span className="text-[11px] truncate font-semibold">{msg.fileName || "Attachment"}</span>
                        </a>
                      )}

                      <div className="break-words leading-relaxed">{msg.message}</div>

                      <div className="text-[9px] opacity-70 text-right mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
          {file && (
            <div className="mb-2 p-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-between text-xs">
              <span className="truncate font-semibold text-[var(--color-accent)]">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="text-xs text-rose-500 font-bold hover:underline">Remove</button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-primary)] transition-colors"
              title="Attach File"
            >
              <Paperclip size={18} />
            </button>
            <input
              type="text"
              placeholder="Type your message…"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="input flex-1 py-2 text-xs bg-[var(--color-bg-primary)] border-[var(--color-border)]"
            />
            <button
              type="submit"
              disabled={(!newMessage.trim() && !file) || sending}
              className="btn-primary py-2 px-3 text-xs"
            >
              {sending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            </button>
          </form>
        </div>
      </div>

      {/* ── Create Group Modal ── */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="glass-card w-full max-w-md bg-[var(--color-surface)] p-6 rounded-2xl border border-[var(--color-border)] shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="font-bold text-base text-[var(--color-text-primary)]">Create New Group Channel</h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-[var(--color-text-tertiary)] hover:text-black">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold mb-1 block">Group Channel Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Export Calling Desk"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="font-bold mb-1 block">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Dedicated coordination for overseas calls"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="font-bold mb-1 block">Select Members ({selectedMemberIds.length} selected)</label>
                <div className="max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-xl p-2 bg-[var(--color-bg-primary)] space-y-1.5 custom-scrollbar">
                  {usersList.map((u) => (
                    <label key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-surface)] cursor-pointer text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0071e3] to-[#5856d6] text-white flex items-center justify-center text-[10px] font-bold">
                          {(u.name || u.email)?.[0]?.toUpperCase()}
                        </span>
                        <div>
                          <div className="font-bold">{u.name || u.email}</div>
                          <div className="text-[10px] text-[var(--color-text-tertiary)] capitalize">{u.role?.replace("_", " ")}</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(u.id)}
                        onChange={() => handleToggleMember(u.id)}
                        className="rounded accent-[var(--color-accent)]"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <button type="button" onClick={() => setShowCreateGroupModal(false)} className="btn-secondary py-1.5 px-3">
                  Cancel
                </button>
                <button type="submit" disabled={creatingGroup || !groupName.trim()} className="btn-primary py-1.5 px-4">
                  {creatingGroup ? "Creating…" : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
