"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Mail,
  Plus,
  Send,
  FileText,
  X,
  Search,
  RefreshCw,
  Paperclip,
  Bold,
  Italic,
  Code,
  Link as LinkIcon,
  Image,
  AtSign,
  Trash2,
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
}

function ComposeEmailModal({ onClose }: ComposeEmailModalProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

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
            <button className="v3-topbar-btn-icon" style={{ width: 24, height: 24 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>−</span>
            </button>
            <button className="v3-topbar-btn-icon" style={{ width: 24, height: 24 }}>
              <span style={{ fontSize: 12 }}>⤢</span>
            </button>
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
                Anish Kataria
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
              <span style={{ fontSize: 12, color: "var(--v3-text-ghost)", cursor: "pointer" }}>Cc / Bcc</span>
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
          <div style={{ padding: "16px 20px", minHeight: 200 }}>
            <textarea
              className="v3-textarea"
              style={{ border: "none", background: "transparent", padding: 0, minHeight: 160 }}
              placeholder="Write your email..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p style={{ fontSize: 12, color: "var(--v3-text-ghost)", marginTop: 8 }}>
              Sent with <span style={{ color: "var(--v3-text-link)" }}>Friday</span>
            </p>
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
          <button className="v3-topbar-btn-icon" style={{ width: 28, height: 28 }}>
            <AtSign size={14} />
          </button>
          <button className="v3-topbar-btn-icon" style={{ width: 28, height: 28 }}>
            <Image size={14} />
          </button>
          <button className="v3-topbar-btn-icon" style={{ width: 28, height: 28 }}>
            <Code size={14} />
          </button>
          <button className="v3-topbar-btn-icon" style={{ width: 28, height: 28 }}>
            <Paperclip size={14} />
          </button>
          <button className="v3-topbar-btn-icon" style={{ width: 28, height: 28 }}>
            <LinkIcon size={14} />
          </button>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--v3-text-tertiary)" }}>
              <div className="v3-toggle" />
              Mass sending
            </label>
            <span style={{ color: "var(--v3-text-ghost)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
              ⓘ
            </span>
            <button className="v3-topbar-btn-icon" style={{ width: 28, height: 28 }}>
              <Trash2 size={14} />
            </button>
            <button className="v3-btn-primary">
              <Send size={12} />
              Send email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function V3EmailsPage() {
  const router = useRouter();
  const { data, isLoading } = useEmailThreads();
  const syncMutation = useSyncEmails();
  const [tab, setTab] = useState<"drafts" | "outbox" | "templates">("drafts");
  const [showCompose, setShowCompose] = useState(false);

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
          <span style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>Help</span>
          <button className="v3-btn-primary" onClick={() => setShowCompose(true)}>
            <Mail size={14} />
            Compose email
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
                <th>Draft</th>
                <th>Creation date</th>
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
                      {thread.snippet?.slice(0, 60)}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>
                    {thread.lastMessageAt
                      ? new Date(thread.lastMessageAt).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCompose && <ComposeEmailModal onClose={() => setShowCompose(false)} />}
    </div>
  );
}
