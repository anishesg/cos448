"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Send,
  Sparkles,
  RefreshCw,
  Calendar,
  MoreHorizontal,
  Zap,
  Pause,
  Mail,
  User,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

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
  pendingDraft?: {
    id: string;
    output: { draft: string; riskLevel?: string };
  };
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

function useSchedule(threadId: string) {
  return useQuery({
    queryKey: ["schedule", threadId],
    queryFn: async () => {
      const res = await fetch(`/api/emails/${threadId}/schedule`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: false,
  });
}

export default function V3ThreadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useThreadDetail(id);
  const draftMutation = useDraftReply(id);
  const sendMutation = useSendReply(id);
  const automateMutation = useAutomate(id);
  const [replyText, setReplyText] = useState("");
  const [showActions, setShowActions] = useState(false);

  if (isLoading) {
    return (
      <div>
        <div className="v3-page-header">
          <button className="v3-topbar-btn-ghost" onClick={() => router.back()}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading thread...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <div className="v3-page-header">
          <button className="v3-topbar-btn-ghost" onClick={() => router.back()}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
        <div className="v3-empty-state">
          <h3>Thread not found</h3>
        </div>
      </div>
    );
  }

  const { thread, messages, contact, pendingDraft } = data;

  const handleSend = () => {
    const body = replyText || pendingDraft?.output?.draft;
    if (body) {
      sendMutation.mutate(body);
      setReplyText("");
    }
  };

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
                    fetch(`/api/emails/${id}/actions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "ignore" }),
                    });
                    setShowActions(false);
                  }}>Ignore</button>
                  <button className="v3-dropdown-item" onClick={() => {
                    fetch(`/api/emails/${id}/actions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "mark_lead" }),
                    });
                    setShowActions(false);
                  }}>Mark as Lead</button>
                  <button className="v3-dropdown-item" onClick={() => {
                    fetch(`/api/emails/${id}/actions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "archive" }),
                    });
                    setShowActions(false);
                  }}>Archive</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              style={{
                marginBottom: 20,
                padding: "16px 20px",
                borderRadius: "var(--v3-radius-lg)",
                border: "1px solid var(--v3-border)",
                background: msg.direction === "outbound"
                  ? "rgba(99, 102, 241, 0.04)"
                  : "var(--v3-bg-surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div className="v3-avatar v3-avatar-sm" style={{
                  background: msg.direction === "outbound" ? "var(--v3-accent-indigo)" : "var(--v3-accent-green)"
                }}>
                  {(msg.senderName || msg.senderEmail || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
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
          ))}

          {/* Pending draft */}
          {pendingDraft && (
            <div
              style={{
                marginBottom: 20,
                padding: "16px 20px",
                borderRadius: "var(--v3-radius-lg)",
                border: "1px dashed var(--v3-accent-indigo)",
                background: "rgba(99, 102, 241, 0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Sparkles size={14} style={{ color: "var(--v3-accent-indigo)" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--v3-accent-indigo)" }}>
                  AI Draft Ready
                </span>
                {pendingDraft.output.riskLevel && (
                  <span className={`v3-badge ${
                    pendingDraft.output.riskLevel === "high" ? "v3-badge-red" :
                    pendingDraft.output.riskLevel === "medium" ? "v3-badge-amber" : "v3-badge-green"
                  }`}>
                    {pendingDraft.output.riskLevel} risk
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--v3-text-secondary)", whiteSpace: "pre-wrap" }}>
                {pendingDraft.output.draft}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="v3-btn-primary"
                  onClick={() => {
                    sendMutation.mutate(pendingDraft.output.draft);
                  }}
                  disabled={sendMutation.isPending}
                  style={{ fontSize: 12 }}
                >
                  <Send size={12} />
                  {sendMutation.isPending ? "Sending..." : "Send Draft"}
                </button>
                <button
                  className="v3-btn-secondary"
                  onClick={() => setReplyText(pendingDraft.output.draft)}
                  style={{ fontSize: 12 }}
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reply box */}
        <div
          style={{
            borderTop: "1px solid var(--v3-border)",
            padding: "16px 24px",
            flexShrink: 0,
          }}
        >
          <textarea
            className="v3-textarea"
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            style={{ minHeight: 80 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button
              className="v3-btn-primary"
              onClick={handleSend}
              disabled={sendMutation.isPending || (!replyText && !pendingDraft)}
            >
              <Send size={12} />
              {sendMutation.isPending ? "Sending..." : "Send"}
            </button>
          </div>
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
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>{contact.name || contact.email}</h3>
              <p style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>{contact.email}</p>
            </div>

            <div className="v3-right-panel-section">
              <div className="v3-right-panel-label">Details</div>
              {contact.company && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
                  <Building2 size={14} style={{ color: "var(--v3-text-ghost)" }} />
                  {contact.company}
                </div>
              )}
              {contact.role && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
                  <User size={14} style={{ color: "var(--v3-text-ghost)" }} />
                  {contact.role}
                </div>
              )}
              {contact.relationshipType && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
                  <span className="v3-badge v3-badge-default">{contact.relationshipType}</span>
                </div>
              )}
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
                <span>{contact.totalInteractions}</span>
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
                <div style={{ padding: "6px 0", fontSize: 12, color: "var(--v3-text-tertiary)" }}>
                  Objective: {thread.agentObjective}
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
