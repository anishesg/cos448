"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  Users,
  Brain,
  AlertCircle,
  TrendingUp,
  UserCheck,
  CalendarCheck,
  Star,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  stage: string;
  fitScore?: number | null;
  relationshipType?: string | null;
}

interface LeadsResponse {
  leads: Lead[];
  stages: {
    new: Lead[];
    engaged: Lead[];
    draft_ready: Lead[];
    contacted: Lead[];
    meeting_scheduled: Lead[];
  };
  total: number;
}

interface IntelChunk {
  id: string;
  title?: string | null;
  content?: string | null;
  createdAt?: string | null;
  sourceName?: string | null;
}

interface IntelResponse {
  chunks?: IntelChunk[];
  sources?: { id: string; name: string }[];
}

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  fitScore?: number | null;
  businessCategory?: string | null;
}

interface ContactsResponse {
  contacts: Contact[];
}

// ── Queries ───────────────────────────────────────────────────────────────────

function useLeads() {
  return useQuery<LeadsResponse>({
    queryKey: ["leads-report"],
    queryFn: async () => {
      const res = await fetch("/api/leads");
      if (!res.ok) return { leads: [], stages: { new: [], engaged: [], draft_ready: [], contacted: [], meeting_scheduled: [] }, total: 0 };
      return res.json();
    },
    staleTime: 60_000,
  });
}

function useIntelligence() {
  return useQuery<IntelResponse>({
    queryKey: ["intelligence-report"],
    queryFn: async () => {
      const res = await fetch("/api/intelligence");
      if (!res.ok) return { chunks: [], sources: [] };
      return res.json();
    },
    staleTime: 60_000,
  });
}

function useContacts() {
  return useQuery<ContactsResponse>({
    queryKey: ["contacts-report"],
    queryFn: async () => {
      const res = await fetch("/api/contacts?limit=200");
      if (!res.ok) return { contacts: [] };
      return res.json();
    },
    staleTime: 60_000,
  });
}

// ── Components ────────────────────────────────────────────────────────────────

function PipelineStatCard({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div
      className="v3-card"
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${accent}18`,
          border: `1px solid ${accent}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          marginBottom: 4,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color: "var(--v3-text-primary)",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--v3-text-tertiary)", fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: "var(--v3-text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 14,
        marginTop: 36,
      }}
    >
      {title}
    </h2>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function V3ReportsPage() {
  const { data: leadsData, isLoading: leadsLoading } = useLeads();
  const { data: intelData, isLoading: intelLoading } = useIntelligence();
  const { data: contactsData, isLoading: contactsLoading } = useContacts();

  const isLoading = leadsLoading || intelLoading || contactsLoading;

  // Pipeline stats
  const totalLeads = leadsData?.total ?? 0;
  const engagedLeads =
    (leadsData?.stages?.engaged?.length ?? 0) +
    (leadsData?.stages?.draft_ready?.length ?? 0);
  const meetingsScheduled = leadsData?.stages?.meeting_scheduled?.length ?? 0;
  const clients = (leadsData?.leads ?? []).filter(
    (l) => l.relationshipType === "active_client"
  ).length;

  // Recent research chunks (last 5)
  const recentChunks = (intelData?.chunks ?? []).slice(0, 5);

  // Top 10 contacts by fitScore
  const topContacts = [...(contactsData?.contacts ?? [])]
    .filter((c) => c.fitScore != null)
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))
    .slice(0, 10);

  // Thread activity by businessCategory — use leads recentThreads indirectly
  // Build category counts from leads
  const categoryCounts: Record<string, number> = {};
  for (const lead of leadsData?.leads ?? []) {
    const cat = (lead as Lead & { recentThreads?: { businessCategory?: string | null }[] })
      .recentThreads
      ?.map((t) => t.businessCategory)
      .filter(Boolean) ?? [];
    for (const c of cat) {
      if (c) categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
    }
  }
  const categoryEntries = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCatCount = categoryEntries[0]?.[1] ?? 1;

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <BarChart2 size={16} />
            Reports
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        {isLoading ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              color: "var(--v3-text-tertiary)",
              fontSize: 13,
            }}
          >
            Loading reports...
          </div>
        ) : (
          <>
            {/* ── Pipeline stats ─────────────────────────────────────────── */}
            <SectionHeader title="Pipeline" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <PipelineStatCard
                icon={<Users size={15} />}
                value={totalLeads}
                label="Total Leads"
                accent="var(--v3-accent-indigo)"
              />
              <PipelineStatCard
                icon={<TrendingUp size={15} />}
                value={engagedLeads}
                label="Engaged Leads"
                accent="var(--v3-accent-blue)"
              />
              <PipelineStatCard
                icon={<CalendarCheck size={15} />}
                value={meetingsScheduled}
                label="Meetings Scheduled"
                accent="var(--v3-accent-green)"
              />
              <PipelineStatCard
                icon={<UserCheck size={15} />}
                value={clients}
                label="Active Clients"
                accent="var(--v3-accent-purple)"
              />
            </div>

            {/* ── Top contacts by fit score ──────────────────────────────── */}
            <SectionHeader title="Top Contacts by Fit Score" />
            {topContacts.length === 0 ? (
              <div
                className="v3-card"
                style={{
                  padding: "28px 24px",
                  textAlign: "center",
                  color: "var(--v3-text-tertiary)",
                  fontSize: 13,
                }}
              >
                No contacts with fit scores yet.
              </div>
            ) : (
              <div className="v3-card" style={{ overflow: "hidden", padding: 0 }}>
                <table className="v3-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 20 }}>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Fit Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topContacts.map((c, i) => (
                      <tr key={c.id}>
                        <td
                          style={{
                            paddingLeft: 20,
                            color: "var(--v3-text-ghost)",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {i + 1}
                        </td>
                        <td style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>
                          {c.name || "—"}
                        </td>
                        <td style={{ color: "var(--v3-text-secondary)", fontSize: 12 }}>
                          {c.email || "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                height: 6,
                                width: Math.round((c.fitScore ?? 0) * 0.8),
                                borderRadius: 3,
                                background:
                                  (c.fitScore ?? 0) >= 80
                                    ? "var(--v3-accent-green)"
                                    : (c.fitScore ?? 0) >= 50
                                    ? "var(--v3-accent-amber)"
                                    : "var(--v3-accent-indigo)",
                                minWidth: 4,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--v3-text-primary)",
                              }}
                            >
                              {c.fitScore}
                            </span>
                            {(c.fitScore ?? 0) >= 80 && (
                              <Star
                                size={12}
                                fill="var(--v3-accent-amber)"
                                color="var(--v3-accent-amber)"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Thread activity by category ───────────────────────────── */}
            <SectionHeader title="Thread Activity by Category" />
            {categoryEntries.length === 0 ? (
              <div
                className="v3-card"
                style={{
                  padding: "28px 24px",
                  textAlign: "center",
                  color: "var(--v3-text-tertiary)",
                  fontSize: 13,
                }}
              >
                No thread activity yet.
              </div>
            ) : (
              <div
                className="v3-card"
                style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}
              >
                {categoryEntries.map(([cat, count]) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--v3-text-secondary)",
                        minWidth: 140,
                        textTransform: "capitalize",
                      }}
                    >
                      {cat.replace(/_/g, " ")}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        background: "var(--v3-bg-hover)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round((count / maxCatCount) * 100)}%`,
                          background: "var(--v3-accent-indigo)",
                          borderRadius: 4,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--v3-text-primary)",
                        minWidth: 24,
                        textAlign: "right",
                      }}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Recent research ───────────────────────────────────────── */}
            <SectionHeader title="Recent Research" />
            {recentChunks.length === 0 ? (
              <div
                className="v3-card"
                style={{
                  padding: "28px 24px",
                  textAlign: "center",
                  color: "var(--v3-text-tertiary)",
                  fontSize: 13,
                }}
              >
                No intelligence chunks yet. Add knowledge sources to get started.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="v3-card"
                    style={{ padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12 }}
                  >
                    <Brain
                      size={14}
                      style={{
                        color: "var(--v3-accent-purple)",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {chunk.title && (
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--v3-text-primary)",
                            marginBottom: 4,
                          }}
                        >
                          {chunk.title}
                        </div>
                      )}
                      {chunk.content && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--v3-text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical" as const,
                          }}
                        >
                          {chunk.content}
                        </div>
                      )}
                      {chunk.sourceName && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--v3-text-ghost)",
                            marginTop: 4,
                          }}
                        >
                          {chunk.sourceName}
                          {chunk.createdAt && (
                            <>
                              {" · "}
                              {new Date(chunk.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── AI activity placeholder ───────────────────────────────── */}
            <SectionHeader title="AI Activity" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div className="v3-card" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <AlertCircle
                    size={14}
                    style={{ color: "var(--v3-accent-amber)" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--v3-text-tertiary)", fontWeight: 500 }}>
                    AI Actions (7d)
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    color: "var(--v3-text-primary)",
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  {(intelData?.chunks?.length ?? 0) + meetingsScheduled + engagedLeads}
                </div>
                <div style={{ fontSize: 12, color: "var(--v3-text-ghost)" }}>
                  classifications, research &amp; outreach
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
