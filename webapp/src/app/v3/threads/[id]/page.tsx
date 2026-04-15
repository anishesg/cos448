"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Send,
  Sparkles,
  MoreHorizontal,
  Zap,
  User,
  Building2,
  AlertCircle,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

interface ThreadMessage {
  id: string;
  direction: string;
  senderEmail: string;
  senderName: string;
  bodySummary: string;
  bodyFull: string;
  sentAt: string;
  isAgentGenerated: boolean;
}

interface ThreadData {
  thread: {
    id: string;
    subject: string;
    businessCategory: string;
    urgency: string;
    currentState: string;
    agentObjective: string;
    automationStatus: string;
    automationTurns: number;
    lastMessageAt: string;
    messageCount: number;
    classification?: Record<string, unknown>;
  };
  messages: ThreadMessage[];
  contact: {
    id: string;
    name: string;
    email: string;
    company: string;
    role: string;
    relationshipType: string;
    fitScore: number;
    totalInteractions: number;
  } | null;
  draft: string | null;
}

function useThreadDetail(threadId: string) {
  return useQuery<ThreadData>({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/messages`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!threadId,
  });
}

function useDraftReply(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/draft`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["thread", threadId] }),
  });
}

function useSendReply(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/emails/${threadId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["thread", threadId] }),
  });
}

function useAutomate(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/automate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["thread", threadId] }),
  });
}

function useThreadAction(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: string) => {
      const res = await fetch(`/api/emails/${threadId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Action failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
  });
}

function ThreadSkeleton() {
  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            padding: "16px 20px",
            borderRadius: "var(--v3-radius-lg)",
            border: "1px solid var(--v3-border)",
            background: "var(--v3-bg-surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div className="v3-skeleton" style={{ width: 22, height: 22, borderRadius: "50%" }} />
            <div className="v3-skeleton" style={{ width: 120, height: 13, borderRadius: 4 }} />
            <div className="v3-skeleton" style={{ width: 60, height: 11, borderRadius: 4, marginLeft: "auto" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="v3-skeleton" style={{ width: "100%", height: 13, borderRadius: 4 }} />
            <div className="v3-skeleton" style={{ width: "80%", height: 13, borderRadius: 4 }} />
            <div className="v3-skeleton" style={{ width: "60%", height: 13, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function V3ThreadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useThreadDetail(id);
  const draftMutation = useDraftReply(id);
  const sendMutation = useSendReply(id);
  const automateMutation = useAutomate(id);
  const actionMutation = useThreadAction(id);
  const [replyText, setReplyText] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to latest message on load and after mutations
  useEffect(() => {
    if (data?.messages?.length) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [data?.messages?.length, data?.draft]);

  // Auto-open reply box when a draft is ready
  useEffect(() => {
    if (data?.draft) {
      setReplyOpen(true);
    }
  }, [data?.draft]);

  const handleSend = () => {
    const body = replyText || data?.draft;
    if (body) {
      sendMutation.mutate(body);
      setReplyText("");
      setReplyOpen(false);
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", height: "100vh" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="v3-page-header" style={{ flexShrink: 0 }}>
            <button className="v3-topbar-btn-ghost" onClick={() => router.back()}>
              <ArrowLeft size={14} />
            </button>
          </div>
          <ThreadSkeleton />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div>
        <div className="v3-page-header">
          <button className="v3-topbar-btn-ghost" onClick={() => router.back()}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
        <div className="v3-empty-state">
          <AlertCircle size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
          <h3>{isError ? "Failed to load thread" : "Thread not found"}</h3>
          <p>{isError ? "Something went wrong. Please try again." : "This thread may have been deleted or archived."}</p>
        </div>
      </div>
    );
  }

  const { thread, messages, contact, draft } = data;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div className="v3-page-header" style={{ flexShrink: 0 }}>
          <div className="v3-page-header-left">
            <button
              className="v3-topbar-btn-ghost"
              onClick={() => router.push("/v3/threads")}
              style={{ fontSize: 12 }}
            >
              <ArrowLeft size={14} />
            </button>
            <span className="v3-page-header-title">
              {thread.subject || "(no subject)"}
            </span>
            {thread.businessCategory && (
              <span className="v3-badge v3-badge-default">{thread.businessCategory}</span>
            )}
            {thread.urgency && (
              <span className={`v3-badge ${
                thread.urgency === "critical" ? "v3-badge-red" :
                thread.urgency === "high" ? "v3-badge-amber" : "v3-badge-default"
              }`}>
                {thread.urgency}
              </span>
            )}
          </div>
          <div className="v3-page-header-right">
            <button
              className="v3-btn-secondary"
              onClick={() => draftMutation.mutate()}
              disabled={draftMutation.isPending}
              style={{ fontSize: 12 }}
            >
              <Sparkles size={12} />
              {draftMutation.isPending ? "Drafting..." : "AI Draft"}
            </button>
            <button
              className="v3-btn-primary"
              onClick={() => automateMutation.mutate()}
              disabled={automateMutation.isPending}
              style={{ fontSize: 12 }}
            >
              <Zap size={12} />
              {automateMutation.isPending ? "Automating..." : "Automate"}
            </button>
            <div style={{ position: "relative" }}>
              <button className="v3-topbar-btn-icon" onClick={() => setShowActions(!showActions)}>
                <MoreHorizontal size={16} />
              </button>
              {showActions && (
                <div className="v3-dropdown" style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 20 }}>
                  <button className="v3-dropdown-item" onClick={() => {
                    actionMutation.mutate("ignore");
                    setShowActions(false);
                  }}>Ignore</button>
                  <button className="v3-dropdown-item" onClick={() => {
                    actionMutation.mutate("mark_lead");
                    setShowActions(false);
                  }}>Mark as Lead</button>
                  <button className="v3-dropdown-item" onClick={() => {
                    actionMutation.mutate("archive");
                    setShowActions(false);
                  }}>Archive</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          {messages.map((msg) => {
            const isOutbound = msg.direction === "outbound";
            return (
              <div
                key={msg.id}
                style={{
                  marginBottom: 16,
                  padding: "14px 18px",
                  borderRadius: "var(--v3-radius-lg)",
                  border: "1px solid var(--v3-border)",
                  borderLeft: isOutbound
                    ? "3px solid var(--v3-accent-blue)"
                    : "1px solid var(--v3-border)",
                  background: isOutbound
                    ? "var(--v3-tint-indigo-bg)"
                    : "var(--v3-bg-surface)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div className="v3-avatar v3-avatar-sm" style={{
                    background: isOutbound ? "var(--v3-accent-blue)" : "var(--v3-accent-green)"
                  }}>
                    {(msg.senderName || msg.senderEmail || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--v3-text-primary)" }}>
                      {msg.senderName || msg.senderEmail}
                    </span>
                    {msg.isAgentGenerated && (
                      <span className="v3-badge v3-badge-purple" style={{ marginLeft: 8 }}>
                        <Sparkles size={10} />
                        AI
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--v3-text-ghost)" }}>
                    {msg.sentAt && new Date(msg.sentAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: "var(--v3-text-secondary)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.bodySummary || msg.bodyFull || "(empty)"}
                </div>
              </div>
            );
          })}

          {/* AI Draft */}
          {draft && (
            <div
              style={{
                marginBottom: 16,
                padding: "14px 18px",
                borderRadius: "var(--v3-radius-lg)",
                border: "1px solid var(--v3-tint-purple-bd)",
                background: "var(--v3-tint-purple-bg)",
                boxShadow: "0 1px 4px rgba(124,58,237,0.07)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Sparkles size={14} style={{ color: "var(--v3-accent-violet)" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--v3-accent-violet)" }}>
                  AI Draft Ready
                </span>
                {thread.classification && (thread.classification as { riskLevel?: string }).riskLevel && (
                  <span className={`v3-badge ${
                    (thread.classification as { riskLevel?: string }).riskLevel === "high" ? "v3-badge-red" :
                    (thread.classification as { riskLevel?: string }).riskLevel === "medium" ? "v3-badge-amber" : "v3-badge-green"
                  }`}>
                    {(thread.classification as { riskLevel?: string }).riskLevel} risk
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--v3-text-secondary)", whiteSpace: "pre-wrap" }}>
                {draft}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="v3-btn-primary"
                  onClick={() => sendMutation.mutate(draft)}
                  disabled={sendMutation.isPending}
                  style={{ fontSize: 12 }}
                >
                  <Send size={12} />
                  {sendMutation.isPending ? "Sending..." : "Send Draft"}
                </button>
                <button
                  className="v3-btn-secondary"
                  onClick={() => {
                    setReplyText(draft);
                    setReplyOpen(true);
                  }}
                  style={{ fontSize: 12 }}
                >
                  Edit
                </button>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply area */}
        <div style={{ borderTop: "1px solid var(--v3-border)", flexShrink: 0 }}>
          {!replyOpen ? (
            <div style={{ padding: "10px 24px" }}>
              <button
                className="v3-btn-secondary"
                onClick={() => setReplyOpen(true)}
                style={{ fontSize: 12 }}
              >
                <MessageSquare size={13} />
                Reply
              </button>
            </div>
          ) : (
            <div style={{ padding: "16px 24px" }}>
              <textarea
                className="v3-textarea"
                placeholder="Write a reply… (⌘↵ to send)"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleReplyKeyDown}
                style={{ minHeight: 88 }}
                autoFocus
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button
                  className="v3-btn-secondary"
                  onClick={() => { setReplyOpen(false); setReplyText(""); }}
                  style={{ fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  className="v3-btn-primary"
                  onClick={handleSend}
                  disabled={sendMutation.isPending || !replyText}
                >
                  <Send size={12} />
                  {sendMutation.isPending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar - Contact card */}
      <div className="v3-right-panel" style={{ width: 280 }}>
        {contact ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div className="v3-avatar v3-avatar-lg" style={{ margin: "0 auto 12px", background: "var(--v3-accent-green)" }}>
                {(contact.name || contact.email)[0].toUpperCase()}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--v3-text-primary)" }}>{contact.name || contact.email}</h3>
              <p style={{ fontSize: 12, color: "var(--v3-text-tertiary)", marginTop: 2 }}>{contact.email}</p>
            </div>

            <div className="v3-right-panel-section">
              <div className="v3-right-panel-label">Details</div>
              {contact.company && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
                  <Building2 size={14} style={{ color: "var(--v3-text-ghost)", flexShrink: 0 }} />
                  <span style={{ color: "var(--v3-text-secondary)" }}>{contact.company}</span>
                </div>
              )}
              {contact.role && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
                  <User size={14} style={{ color: "var(--v3-text-ghost)", flexShrink: 0 }} />
                  <span style={{ color: "var(--v3-text-secondary)" }}>{contact.role}</span>
                </div>
              )}
              {contact.relationshipType && (
                <div style={{ padding: "6px 0" }}>
                  <span className="v3-badge v3-badge-default">{contact.relationshipType}</span>
                </div>
              )}
              <div style={{ paddingTop: 8 }}>
                <Link
                  href="/v3/people"
                  style={{
                    fontSize: 12,
                    color: "var(--v3-text-link)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    textDecoration: "none",
                  }}
                >
                  View contact <ChevronRight size={11} />
                </Link>
              </div>
            </div>

            <div className="v3-right-panel-section">
              <div className="v3-right-panel-label">Metrics</div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: "var(--v3-text-tertiary)" }}>Fit Score</span>
                {contact.fitScore != null ? (
                  <span className={`v3-badge ${contact.fitScore >= 70 ? "v3-badge-green" : "v3-badge-amber"}`}>
                    {contact.fitScore}
                  </span>
                ) : (
                  <span style={{ color: "var(--v3-text-ghost)" }}>—</span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: "var(--v3-text-tertiary)" }}>Interactions</span>
                <span style={{ color: "var(--v3-text-secondary)" }}>{contact.totalInteractions}</span>
              </div>
            </div>

            <div className="v3-right-panel-section">
              <div className="v3-right-panel-label">Thread Info</div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: "var(--v3-text-tertiary)" }}>State</span>
                <span className="v3-badge v3-badge-default">{thread.currentState?.replace(/_/g, " ")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: "var(--v3-text-tertiary)" }}>Automation</span>
                <span className={`v3-badge ${thread.automationStatus === "active" ? "v3-badge-green" : "v3-badge-default"}`}>
                  {thread.automationStatus || "off"}
                </span>
              </div>
              {thread.agentObjective && (
                <div style={{ padding: "6px 0", fontSize: 12, color: "var(--v3-text-tertiary)", lineHeight: 1.5 }}>
                  {thread.agentObjective}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--v3-text-ghost)" }}>
            <User size={32} style={{ opacity: 0.2, marginBottom: 12, margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13 }}>No contact linked</p>
          </div>
        )}
      </div>
    </div>
  );
}
