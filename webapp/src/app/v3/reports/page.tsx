"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Mail,
  Users,
  Brain,
  Zap,
  Eye,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface ReportStats {
  totalThreads: number;
  unclassifiedThreads: number;
  totalContacts: number;
  knowledgeSources: number;
  knowledgeChunks: number;
  activeAlerts: number;
  highUrgencyAlerts: number;
}

function useReportStats() {
  return useQuery<ReportStats>({
    queryKey: ["report-stats"],
    queryFn: async () => {
      const [emailsRes, contactsRes, intelligenceRes, watchtowerRes] = await Promise.all([
        fetch("/api/emails?limit=1000"),
        fetch("/api/contacts?limit=1000"),
        fetch("/api/intelligence?action=list_sources"),
        fetch("/api/watchtower"),
      ]);

      const emails = emailsRes.ok ? await emailsRes.json() : { threads: [] };
      const contacts = contactsRes.ok ? await contactsRes.json() : { contacts: [] };
      const intelligence = intelligenceRes.ok ? await intelligenceRes.json() : { sources: [], chunks: [] };
      const watchtower = watchtowerRes.ok ? await watchtowerRes.json() : { alerts: [], summary: {} };

      return {
        totalThreads: emails.threads?.length ?? 0,
        unclassifiedThreads: (emails.threads ?? []).filter((t: Record<string, unknown>) => !t.classification).length,
        totalContacts: contacts.contacts?.length ?? 0,
        knowledgeSources: intelligence.sources?.length ?? 0,
        knowledgeChunks: intelligence.chunks?.length ?? 0,
        activeAlerts: watchtower.summary?.total ?? watchtower.alerts?.length ?? 0,
        highUrgencyAlerts: watchtower.summary?.high ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

function StatCard({ icon, label, value, subtitle, tintBg, tintBd, iconColor }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle?: string;
  tintBg: string;
  tintBd: string;
  iconColor: string;
}) {
  return (
    <div className="v3-card" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: tintBg,
          border: `1px solid ${tintBd}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--v3-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: "var(--v3-text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: "var(--v3-text-ghost)" }}>{subtitle}</div>
      )}
    </div>
  );
}

export default function V3ReportsPage() {
  const { data: stats, isLoading, isError } = useReportStats();

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <BarChart3 size={16} />
            Reports
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading reports...</div>
        ) : isError ? (
          <div className="v3-empty-state">
            <AlertCircle size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
            <h3>Failed to load reports</h3>
            <p>Something went wrong. Please try refreshing.</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Overview</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 32 }}>
              <StatCard
                icon={<Mail size={16} />}
                label="Email Threads"
                value={stats?.totalThreads ?? 0}
                subtitle={stats?.unclassifiedThreads ? `${stats.unclassifiedThreads} unclassified` : "All classified"}
                tintBg="var(--v3-tint-indigo-bg)" tintBd="var(--v3-tint-indigo-bd)" iconColor="var(--v3-accent-indigo)"
              />
              <StatCard
                icon={<Users size={16} />}
                label="Contacts"
                value={stats?.totalContacts ?? 0}
                tintBg="var(--v3-tint-green-bg)" tintBd="var(--v3-tint-green-bd)" iconColor="var(--v3-accent-green)"
              />
              <StatCard
                icon={<Brain size={16} />}
                label="Knowledge Sources"
                value={stats?.knowledgeSources ?? 0}
                subtitle={`${stats?.knowledgeChunks ?? 0} indexed chunks`}
                tintBg="var(--v3-tint-purple-bg)" tintBd="var(--v3-tint-purple-bd)" iconColor="var(--v3-accent-purple)"
              />
              <StatCard
                icon={<Eye size={16} />}
                label="Active Alerts"
                value={stats?.activeAlerts ?? 0}
                subtitle={stats?.highUrgencyAlerts ? `${stats.highUrgencyAlerts} high urgency` : "No urgent alerts"}
                tintBg="var(--v3-tint-amber-bg)" tintBd="var(--v3-tint-amber-bd)" iconColor="var(--v3-accent-amber)"
              />
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Quick Insights</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(stats?.totalThreads ?? 0) === 0 && (
                <div className="v3-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                  <TrendingUp size={16} style={{ color: "var(--v3-text-ghost)" }} />
                  <span style={{ fontSize: 13, color: "var(--v3-text-secondary)" }}>
                    Sync your inbox to start seeing reports and insights.
                  </span>
                </div>
              )}
              {(stats?.highUrgencyAlerts ?? 0) > 0 && (
                <div className="v3-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderColor: "var(--v3-accent-amber)" }}>
                  <Zap size={16} style={{ color: "var(--v3-accent-amber)" }} />
                  <span style={{ fontSize: 13, color: "var(--v3-text-secondary)" }}>
                    You have {stats?.highUrgencyAlerts} high-urgency alert{(stats?.highUrgencyAlerts ?? 0) > 1 ? "s" : ""} that need attention.
                  </span>
                </div>
              )}
              {(stats?.unclassifiedThreads ?? 0) > 0 && (
                <div className="v3-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                  <Mail size={16} style={{ color: "var(--v3-text-ghost)" }} />
                  <span style={{ fontSize: 13, color: "var(--v3-text-secondary)" }}>
                    {stats?.unclassifiedThreads} threads are waiting for classification.
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
