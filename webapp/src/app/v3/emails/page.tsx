"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Mail,
  Send,
  FileText,
  X,
  Trash2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

interface EmailThread {
  id: string;
  subject: string;
  snippet: string;
  lastMessageAt: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  currentState: string;
  businessCategory?: string;
  urgency?: string;
  lastMessageDirection?: string;
}

function useEmailThreads() {
  return useQuery<{ threads: EmailThread[] }>({
    queryKey: ["emails"],
    queryFn: async () => {
      const res = await fetch("/api/emails?limit=50");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

function useSyncEmails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/emails/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
  });
}

interface ComposeEmailModalProps {
  onClose: () => void;
  userName: string;
}

function ComposeEmailModal({ onClose, userName }: ComposeEmailModalProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const handleSend = async () => {
    if (!to.trim() || !body.trim()) {
      setError("Recipient and body are required");
      return;
    }
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send");
      }
      qc.invalidateQueries({ queryKey: ["emails"] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="v3-modal-overlay" onClick={onClose}>
      <div
        className="v3-modal"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v3-modal-header">
          <div className="v3-modal-title">
            <Mail size={16} />
            Compose email
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button className="v3-topbar-btn-icon" onClick={onClose} style={{ width: 24, height: 24 }}>
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="v3-modal-body" style={{ padding: 0 }}>
          <div style={{ padding: "0 20px" }}>
            <div className="v3-compose-row">
              <span className="v3-compose-label">From</span>
              <span className="v3-compose-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="v3-status-dot online" />
                {userName}
              </span>
            </div>
            <div className="v3-compose-row">
              <span className="v3-compose-label">To</span>
              <input
                className="v3-input"
                style={{ border: "none", background: "transparent", height: "auto", padding: 0 }}
                placeholder="Add recipients..."
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="v3-compose-row">
              <span className="v3-compose-label">Subject</span>
              <input
                className="v3-input"
                style={{ border: "none", background: "transparent", height: "auto", padding: 0, fontWeight: 500 }}
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <div style={{ padding: "8px 20px", color: "var(--v3-accent-red, #ef4444)", fontSize: 12 }}>{error}</div>
          )}
          <div style={{ padding: "16px 20px", minHeight: 200 }}>
            <textarea
              className="v3-textarea"
              style={{ border: "none", background: "transparent", padding: 0, minHeight: 160 }}
              placeholder="Write your email..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            borderTop: "1px solid var(--v3-border)",
            gap: 4,
          }}
        >
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <button className="v3-topbar-btn-icon" style={{ width: 28, height: 28 }}>
              <Trash2 size={14} />
            </button>
            <button
              className="v3-btn-primary"
              onClick={handleSend}
              disabled={sending || !to.trim() || !body.trim()}
            >
              <Send size={12} />
              {sending ? "Sending..." : "Send email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useSession() {
  return useQuery<{ user: { name: string | null; email: string } | null }>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session");
      if (!res.ok) return { user: null };
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

export default function V3EmailsPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useEmailThreads();
  const { data: sessionData } = useSession();
  const syncMutation = useSyncEmails();
  const [tab, setTab] = useState<"drafts" | "outbox" | "templates">("drafts");
  const [showCompose, setShowCompose] = useState(false);
  const userName = sessionData?.user?.name || sessionData?.user?.email || "You";

  const threads = data?.threads ?? [];

  const drafts = threads.filter((t) => t.currentState === "draft_ready");
  const outbox = threads.filter(
    (t) => t.lastMessageDirection === "outbound"
  );

  const currentList = tab === "drafts" ? drafts : tab === "outbox" ? outbox : [];

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Mail size={16} />
            Emails
          </span>
        </div>
        <div className="v3-page-header-right">
          <button
            className="v3-btn-secondary"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            style={{ fontSize: 12 }}
          >
            <RefreshCw size={13} className={syncMutation.isPending ? "animate-spin" : ""} />
            {syncMutation.isPending ? "Syncing..." : "Sync"}
          </button>
          <button className="v3-btn-primary" onClick={() => setShowCompose(true)}>
            <Mail size={14} />
            Compose
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="v3-tabs">
        <button className={`v3-tab ${tab === "drafts" ? "active" : ""}`} onClick={() => setTab("drafts")}>
          <FileText size={14} />
          Drafts <span className="v3-tab-count">{drafts.length}</span>
        </button>
        <button className={`v3-tab ${tab === "outbox" ? "active" : ""}`} onClick={() => setTab("outbox")}>
          <Send size={14} />
          Outbox <span className="v3-tab-count">{outbox.length}</span>
        </button>
        <button className={`v3-tab ${tab === "templates" ? "active" : ""}`} onClick={() => setTab("templates")}>
          Templates <span className="v3-tab-count">0</span>
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading...</div>
      ) : isError ? (
        <div className="v3-empty-state">
          <AlertCircle size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
          <h3>Failed to load emails</h3>
          <p>Something went wrong. Please try refreshing.</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="v3-empty-state">
          <div style={{ width: 80, height: 80, marginBottom: 20, opacity: 0.15 }}>
            <Mail size={80} strokeWidth={0.8} />
          </div>
          <h3>Email {tab}</h3>
          <p>
            {tab === "drafts"
              ? "No drafts yet. Create your first email."
              : tab === "outbox"
              ? "No sent emails yet."
              : "No templates yet."}
          </p>
          <button className="v3-btn-primary" style={{ marginTop: 20 }} onClick={() => setShowCompose(true)}>
            <Mail size={14} />
            Compose email
          </button>
        </div>
      ) : (
        <div>
          <table className="v3-table">
            <thead>
              <tr>
                <th>{tab === "outbox" ? "Sent email" : "Draft"}</th>
                <th>{tab === "outbox" ? "Sent date" : "Created"}</th>
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {currentList.map((thread) => (
                <tr
                  key={thread.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/v3/threads/${thread.id}`)}
                >
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>
                      {thread.subject || "(no subject)"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--v3-text-tertiary)", marginTop: 2 }}>
                      {thread.snippet?.slice(0, 80)}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--v3-text-tertiary)", whiteSpace: "nowrap" }}>
                    {thread.lastMessageAt
                      ? new Date(thread.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </td>
                  <td><ChevronRight size={14} className="v3-row-action" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCompose && <ComposeEmailModal onClose={() => setShowCompose(false)} userName={userName} />}
    </div>
  );
}
