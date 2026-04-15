"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Mail,
  Search,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
  SlidersHorizontal,
  Settings,
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
  messageCount: number;
  classification?: { recommendedAction?: string };
}

function useEmailThreads() {
  return useQuery<{ threads: EmailThread[] }>({
    queryKey: ["emails"],
    queryFn: async () => {
      const res = await fetch("/api/emails?limit=100");
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

function useClassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/emails/classify", { method: "POST" });
      if (!res.ok) throw new Error("Classify failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
  });
}

const urgencyColors: Record<string, string> = {
  critical: "v3-badge-red",
  high: "v3-badge-amber",
  medium: "v3-badge-default",
  low: "v3-badge-default",
};

const categoryLabels: Record<string, string> = {
  lead: "Lead",
  active_client: "Client",
  scheduling: "Scheduling",
  admin: "Admin",
  payment: "Payment",
  noise: "Noise",
};

export default function V3ThreadsPage() {
  const router = useRouter();
  const { data, isLoading } = useEmailThreads();
  const syncMutation = useSyncEmails();
  const classifyMutation = useClassify();
  const [searchQuery, setSearchQuery] = useState("");

  const threads = data?.threads ?? [];
  const unclassified = threads.filter((t) => !t.classification).length;

  const filtered = searchQuery
    ? threads.filter(
        (t) =>
          t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : threads;

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Mail size={16} />
            Threads
          </span>
          <span style={{ fontSize: 12, color: "var(--v3-text-ghost)" }}>
            {threads.length} total
          </span>
        </div>
        <div className="v3-page-header-right">
          <button
            className="v3-btn-secondary"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            style={{ fontSize: 12 }}
          >
            <RefreshCw size={12} className={syncMutation.isPending ? "animate-spin" : ""} />
            {syncMutation.isPending ? "Syncing..." : "Sync"}
          </button>
          {unclassified > 0 && (
            <button
              className="v3-btn-primary"
              onClick={() => classifyMutation.mutate()}
              disabled={classifyMutation.isPending}
              style={{ fontSize: 12 }}
            >
              <Sparkles size={12} />
              {classifyMutation.isPending ? "Classifying..." : `Classify ${unclassified}`}
            </button>
          )}
        </div>
      </div>

      <div className="v3-toolbar">
        <div className="v3-sidebar-search-wrapper" style={{ width: 240 }}>
          <Search className="v3-sidebar-search-icon" />
          <input
            className="v3-input"
            placeholder="Search threads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, height: 30, fontSize: 12 }}
          />
        </div>
        <button className="v3-toolbar-btn active">
          <ArrowUpDown size={12} />
          Sorted by Last message
        </button>
        <button className="v3-toolbar-btn">
          <SlidersHorizontal size={12} />
          Filter
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading threads...</div>
      ) : filtered.length === 0 ? (
        <div className="v3-empty-state">
          <Mail size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
          <h3>{searchQuery ? "No matching threads" : "No threads"}</h3>
          <p>{searchQuery ? "Try a different search term." : "Sync your inbox to see threads."}</p>
        </div>
      ) : (
        <table className="v3-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Subject</th>
              <th>Category</th>
              <th>Urgency</th>
              <th>State</th>
              <th>Messages</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                style={{ cursor: "pointer" }}
                onClick={() => router.push(`/v3/threads/${t.id}`)}
              >
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="v3-avatar v3-avatar-sm">
                      {(t.contactName || t.contactEmail || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: "var(--v3-text-primary)", fontSize: 13 }}>
                        {t.contactName || t.contactEmail || "Unknown"}
                      </div>
                      {t.contactEmail && t.contactName && (
                        <div style={{ fontSize: 11, color: "var(--v3-text-ghost)" }}>{t.contactEmail}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ maxWidth: 280 }}>
                  <div style={{ fontSize: 13, color: "var(--v3-text-primary)", fontWeight: 450 }}>
                    {t.subject || "(no subject)"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--v3-text-ghost)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 280,
                    }}
                  >
                    {t.snippet?.slice(0, 80)}
                  </div>
                </td>
                <td>
                  {t.businessCategory && (
                    <span className="v3-badge v3-badge-default">
                      {categoryLabels[t.businessCategory] || t.businessCategory}
                    </span>
                  )}
                </td>
                <td>
                  {t.urgency && (
                    <span className={`v3-badge ${urgencyColors[t.urgency] || "v3-badge-default"}`}>
                      {t.urgency}
                    </span>
                  )}
                </td>
                <td>
                  <span className="v3-badge v3-badge-default">
                    {t.currentState?.replace(/_/g, " ")}
                  </span>
                </td>
                <td>{t.messageCount}</td>
                <td style={{ fontSize: 12, color: "var(--v3-text-tertiary)", whiteSpace: "nowrap" }}>
                  {t.lastMessageAt
                    ? new Date(t.lastMessageAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
