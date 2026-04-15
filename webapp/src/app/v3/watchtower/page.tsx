"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Eye,
  AlertTriangle,
  Clock,
  Flame,
  Calendar,
  ArrowRight,
} from "lucide-react";

interface Alert {
  id: string;
  type: string;
  title: string;
  description?: string;
  urgency?: string;
  threadId?: string;
  threadSubject?: string | null;
  suggestedAction?: string;
  daysSinceLastAction?: number;
}

interface WatchtowerSummary {
  total: number;
  high: number;
  recoverable: number;
}

function useAlerts() {
  return useQuery<{ alerts: Alert[]; summary?: WatchtowerSummary }>({
    queryKey: ["watchtower"],
    queryFn: async () => {
      const res = await fetch("/api/watchtower");
      if (!res.ok) return { alerts: [] };
      return res.json();
    },
  });
}

const typeIcons: Record<string, typeof AlertTriangle> = {
  lead_cooling: Flame,
  lead_needs_reply: Flame,
  scheduling_stall: Calendar,
  client_waiting: Clock,
  stale_workflow: AlertTriangle,
  proposal_forgotten: AlertTriangle,
  payment_risk: AlertTriangle,
  upsell_window: Clock,
};

const typeColors: Record<string, string> = {
  lead_cooling: "v3-badge-amber",
  lead_needs_reply: "v3-badge-amber",
  scheduling_stall: "v3-badge-blue",
  client_waiting: "v3-badge-red",
  stale_workflow: "v3-badge-purple",
  proposal_forgotten: "v3-badge-purple",
  payment_risk: "v3-badge-red",
  upsell_window: "v3-badge-green",
};

const typeTints: Record<string, { bg: string; bd: string }> = {
  lead_cooling:      { bg: "var(--v3-tint-amber-bg)",  bd: "var(--v3-tint-amber-bd)"  },
  lead_needs_reply:  { bg: "var(--v3-tint-amber-bg)",  bd: "var(--v3-tint-amber-bd)"  },
  scheduling_stall:  { bg: "var(--v3-tint-blue-bg)",   bd: "var(--v3-tint-blue-bd)"   },
  client_waiting:    { bg: "var(--v3-tint-rose-bg)",   bd: "var(--v3-tint-rose-bd)"   },
  stale_workflow:    { bg: "var(--v3-tint-purple-bg)", bd: "var(--v3-tint-purple-bd)" },
  proposal_forgotten:{ bg: "var(--v3-tint-purple-bg)", bd: "var(--v3-tint-purple-bd)" },
  payment_risk:      { bg: "var(--v3-tint-rose-bg)",   bd: "var(--v3-tint-rose-bd)"   },
  upsell_window:     { bg: "var(--v3-tint-green-bg)",  bd: "var(--v3-tint-green-bd)"  },
};

export default function V3WatchtowerPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useAlerts();
  const alerts = data?.alerts ?? [];
  const summary = data?.summary;

  const grouped = alerts.reduce((acc, a) => {
    if (!acc[a.type]) acc[a.type] = [];
    acc[a.type].push(a);
    return acc;
  }, {} as Record<string, Alert[]>);

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Eye size={16} />
            Watchtower
          </span>
          <span className="v3-badge v3-badge-default">{alerts.length} alerts</span>
          {summary && summary.high > 0 && (
            <span className="v3-badge v3-badge-red">{summary.high} high priority</span>
          )}
          {summary && summary.recoverable > 0 && (
            <span className="v3-badge v3-badge-amber">{summary.recoverable} recoverable</span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--v3-text-tertiary)" }}>Loading...</div>
        ) : isError ? (
          <div className="v3-empty-state">
            <Eye size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>Failed to load alerts</h3>
            <p>Something went wrong. Please try refreshing.</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="v3-empty-state">
            <Eye size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>All clear</h3>
            <p>No alerts at this time. The watchtower monitors leads, scheduling, and client issues.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {Object.entries(grouped).map(([type, typeAlerts]) => {
              const Icon = typeIcons[type] || AlertTriangle;
              const badgeClass = typeColors[type] || "v3-badge-default";
              const tint = typeTints[type] || { bg: "var(--v3-bg-surface)", bd: "var(--v3-border)" };
              return (
                <div key={type}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--v3-border)" }}>
                    <Icon size={13} style={{ color: "var(--v3-text-tertiary)" }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--v3-text-secondary)" }}>
                      {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                    <span className={`v3-badge ${badgeClass}`}>{typeAlerts.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {typeAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 16px",
                          borderRadius: "var(--v3-radius-md)",
                          border: `1px solid ${alert.urgency === "high" ? "var(--v3-tint-rose-bd)" : tint.bd}`,
                          background: alert.urgency === "high" ? "var(--v3-tint-rose-bg)" : tint.bg,
                          cursor: alert.threadId ? "pointer" : "default",
                          transition: "all 0.12s ease",
                        }}
                        onClick={() => alert.threadId && router.push(`/v3/threads/${alert.threadId}`)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 400, color: "var(--v3-text-primary)" }}>{alert.title}</div>
                          {alert.description && (
                            <div style={{ fontSize: 12, color: "var(--v3-text-tertiary)", marginTop: 2 }}>
                              {alert.description}
                            </div>
                          )}
                          {alert.suggestedAction && (
                            <div style={{ fontSize: 11, color: "var(--v3-text-ghost)", marginTop: 3, fontStyle: "italic" }}>
                              → {alert.suggestedAction}
                            </div>
                          )}
                        </div>
                        {alert.threadSubject && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--v3-text-tertiary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span className="v3-record-dot emails" />
                            {alert.threadSubject}
                          </span>
                        )}
                        {alert.urgency && (
                          <span className={`v3-badge ${alert.urgency === "high" ? "v3-badge-red" : alert.urgency === "medium" ? "v3-badge-amber" : "v3-badge-default"}`}>
                            {alert.urgency}
                          </span>
                        )}
                        {alert.threadId && (
                          <ArrowRight size={14} style={{ color: "var(--v3-text-ghost)" }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
