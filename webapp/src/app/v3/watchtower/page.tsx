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
  severity?: string;
  threadId?: string;
  contactName?: string;
}

function useAlerts() {
  return useQuery<{ alerts: Alert[] }>({
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
  scheduling_stall: Calendar,
  client_waiting: Clock,
  stale_workflow: AlertTriangle,
};

const typeColors: Record<string, string> = {
  lead_cooling: "v3-badge-amber",
  scheduling_stall: "v3-badge-blue",
  client_waiting: "v3-badge-red",
  stale_workflow: "v3-badge-purple",
};

export default function V3WatchtowerPage() {
  const router = useRouter();
  const { data, isLoading } = useAlerts();
  const alerts = data?.alerts ?? [];

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
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--v3-text-tertiary)" }}>Loading...</div>
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
              return (
                <div key={type}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={14} />
                    {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    <span className={`v3-badge ${badgeClass}`}>{typeAlerts.length}</span>
                  </h3>
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
                          border: "1px solid var(--v3-border)",
                          background: "var(--v3-bg-surface)",
                          cursor: alert.threadId ? "pointer" : "default",
                          transition: "background 0.12s ease",
                        }}
                        onClick={() => alert.threadId && router.push(`/v3/threads/${alert.threadId}`)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 450 }}>{alert.title}</div>
                          {alert.description && (
                            <div style={{ fontSize: 12, color: "var(--v3-text-tertiary)", marginTop: 2 }}>
                              {alert.description}
                            </div>
                          )}
                        </div>
                        {alert.contactName && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--v3-text-tertiary)" }}>
                            <span className="v3-record-dot people" />
                            {alert.contactName}
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
