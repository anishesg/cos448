"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Mail,
  Building2,
  Briefcase,
  Layers,
  MessageSquare,
  Globe,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ContactDetail {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  role: string | null;
  relationshipType: string | null;
  relationshipStage: string | null;
  fitScore: number | null;
  revenuePotential: string | null;
  lastContactAt: string | null;
  totalInteractions: number;
}

interface ResearchRecord {
  id: string;
  researchType: string;
  summary: string | null;
  sources: unknown;
  createdAt: string;
}

interface IntelChunk {
  id: string;
  title: string | null;
  content: string;
  sourceType: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
}

interface ThreadSummary {
  id: string;
  subject: string | null;
  lastMessageAt: string | null;
  businessCategory: string | null;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FitBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const cls =
    score >= 70
      ? "v3-badge v3-badge-green"
      : score >= 40
        ? "v3-badge v3-badge-amber"
        : "v3-badge v3-badge-red";
  return <span className={cls}>Fit {score}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--v3-text-ghost)",
        marginBottom: 8,
      }}
    >
      {children}
    </p>
  );
}

function SourceLink({ source }: { source: unknown }) {
  if (!source || typeof source !== "object") return null;
  const s = source as { title?: string; url?: string };
  if (!s.url) return null;
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        color: "var(--v3-text-link)",
        textDecoration: "none",
        background: "var(--v3-tint-blue-bg)",
        border: "1px solid var(--v3-tint-blue-bd)",
        borderRadius: 4,
        padding: "2px 7px",
        marginRight: 4,
        marginBottom: 4,
        flexShrink: 0,
      }}
    >
      <ExternalLink size={10} />
      {s.title ? s.title.slice(0, 40) : s.url.slice(0, 40)}
      {(s.title ?? s.url ?? "").length > 40 ? "…" : ""}
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ContactPanel({
  contactId,
  onClose,
}: {
  contactId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);

  // Animate in when contactId appears
  useEffect(() => {
    if (contactId) {
      // small delay lets the DOM paint before transition starts
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [contactId]);

  const handleClose = useCallback(() => {
    setVisible(false);
    // wait for slide-out animation
    setTimeout(onClose, 200);
  }, [onClose]);

  // ── Keyboard: Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: contactData } = useQuery<{ contacts: ContactDetail[] }>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!contactId,
  });

  const contact = contactData?.contacts.find((c) => c.id === contactId) ?? null;

  const { data: researchData, isLoading: researchLoading } = useQuery<{
    research: ResearchRecord[];
  }>({
    queryKey: ["contact-research", contactId],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}/research`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!contactId,
  });

  const latestResearch = researchData?.research?.[0] ?? null;

  const { data: intelData } = useQuery<{ results: IntelChunk[] }>({
    queryKey: ["intel-contact", contact?.name, contactId],
    queryFn: async () => {
      const q = encodeURIComponent(contact?.name ?? contact?.email ?? "");
      const res = await fetch(`/api/intelligence?q=${q}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!(contact?.name || contact?.email),
  });

  const { data: threadsData } = useQuery<{ threads: ThreadSummary[] }>({
    queryKey: ["threads-contact", contactId],
    queryFn: async () => {
      const res = await fetch(`/api/emails?contact=${contactId}&limit=3`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!contactId,
  });

  // ── Research mutation ──────────────────────────────────────────────────────

  const researchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}/research`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Research failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-research", contactId] });
    },
  });

  // ── Outreach angle extraction ──────────────────────────────────────────────

  const outreachAngle = latestResearch?.summary
    ? (() => {
        const lines = latestResearch.summary.split("\n");
        const idx = lines.findIndex(
          (l) =>
            l.toLowerCase().includes("conversation starter") ||
            l.toLowerCase().includes("talking point") ||
            l.toLowerCase().includes("outreach_angle")
        );
        if (idx === -1) return null;
        const snippet = lines
          .slice(idx, idx + 6)
          .filter((l) => l.trim())
          .join("\n");
        return snippet.length > 20 ? snippet : null;
      })()
    : null;

  // ── Sources ────────────────────────────────────────────────────────────────

  const sourcesRaw = latestResearch?.sources;
  const sources: unknown[] = Array.isArray(sourcesRaw)
    ? sourcesRaw
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!contactId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.15)",
          zIndex: 99,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          height: "100vh",
          width: 480,
          background: "var(--v3-bg-surface)",
          borderLeft: "1px solid var(--v3-border)",
          zIndex: 100,
          overflowY: "auto",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid var(--v3-border)",
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(8px)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              className="v3-avatar v3-avatar-lg"
              style={{ background: "var(--v3-accent-green)", flexShrink: 0 }}
            >
              {(contact?.name || contact?.email || "?")[0].toUpperCase()}
            </div>
            <div>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "var(--v3-text-primary)",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {contact?.name || contact?.email || "Loading…"}
              </p>
              {contact?.role && (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--v3-text-tertiary)",
                    margin: 0,
                  }}
                >
                  {contact.role}
                  {contact.company ? ` · ${contact.company}` : ""}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="v3-topbar-btn-icon"
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Identity card */}
          {contact && (
            <div className="v3-card" style={{ padding: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px 16px",
                }}
              >
                <Row icon={<Mail size={13} />} label="Email" value={contact.email} />
                {contact.company && (
                  <Row icon={<Building2 size={13} />} label="Company" value={contact.company} />
                )}
                {contact.role && (
                  <Row icon={<Briefcase size={13} />} label="Role" value={contact.role} />
                )}
                {contact.relationshipType && (
                  <Row
                    icon={<Layers size={13} />}
                    label="Relationship"
                    value={
                      contact.relationshipStage
                        ? `${contact.relationshipType} · ${contact.relationshipStage}`
                        : contact.relationshipType
                    }
                  />
                )}
                <Row
                  icon={<MessageSquare size={13} />}
                  label="Interactions"
                  value={String(contact.totalInteractions)}
                />
                {contact.lastContactAt && (
                  <Row
                    icon={<MessageSquare size={13} />}
                    label="Last contact"
                    value={new Date(contact.lastContactAt).toLocaleDateString()}
                  />
                )}
              </div>

              {/* Badges row */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                <FitBadge score={contact.fitScore} />
                {contact.revenuePotential && Number(contact.revenuePotential) > 0 && (
                  <span className="v3-badge v3-badge-blue">
                    ${Number(contact.revenuePotential).toLocaleString()} potential
                  </span>
                )}
                {contact.relationshipType && (
                  <span className="v3-badge v3-badge-default">
                    {contact.relationshipType}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Outreach angle / talking points */}
          {outreachAngle && (
            <div className="v3-card v3-card-tint-purple" style={{ padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                  color: "var(--v3-accent-violet)",
                }}
              >
                <Sparkles size={14} />
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--v3-accent-violet)" }}
                >
                  Talking Points
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--v3-text-secondary)",
                  lineHeight: 1.7,
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {outreachAngle}
              </p>
            </div>
          )}

          {/* Research section */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <SectionLabel>Research</SectionLabel>
              <button
                className="v3-topbar-btn-ghost"
                style={{ fontSize: 11, padding: "3px 8px", gap: 4 }}
                onClick={() => researchMutation.mutate()}
                disabled={researchMutation.isPending}
              >
                <RefreshCw
                  size={11}
                  style={{
                    animation: researchMutation.isPending
                      ? "spin 1s linear infinite"
                      : undefined,
                  }}
                />
                {researchMutation.isPending ? "Running…" : "Run Research"}
              </button>
            </div>

            {researchLoading ? (
              <div className="v3-card" style={{ padding: 16 }}>
                <div className="v3-skeleton" style={{ height: 12, width: "70%", marginBottom: 8 }} />
                <div className="v3-skeleton" style={{ height: 12, width: "90%" }} />
              </div>
            ) : latestResearch?.summary ? (
              <div className="v3-card" style={{ padding: 16 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--v3-text-secondary)",
                    lineHeight: 1.7,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    maxHeight: 280,
                    overflowY: "auto",
                  }}
                >
                  {latestResearch.summary}
                </p>

                {sources.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap" }}>
                    {sources.map((s, i) => (
                      <SourceLink key={i} source={s} />
                    ))}
                  </div>
                )}

                <p
                  style={{
                    fontSize: 11,
                    color: "var(--v3-text-tertiary)",
                    marginTop: 10,
                    marginBottom: 0,
                  }}
                >
                  Last updated:{" "}
                  {new Date(latestResearch.createdAt).toLocaleString()}
                </p>
              </div>
            ) : researchMutation.isError ? (
              <div
                className="v3-card"
                style={{
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--v3-accent-red)",
                }}
              >
                <AlertCircle size={14} />
                <span style={{ fontSize: 12 }}>Research failed. Please try again.</span>
              </div>
            ) : (
              <div
                className="v3-card"
                style={{
                  padding: 24,
                  textAlign: "center",
                }}
              >
                <Globe
                  size={32}
                  style={{ opacity: 0.2, marginBottom: 10, margin: "0 auto 10px" }}
                />
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--v3-text-secondary)",
                    marginBottom: 14,
                  }}
                >
                  No research yet for this contact.
                </p>
                <button
                  className="v3-btn-primary"
                  onClick={() => researchMutation.mutate()}
                  disabled={researchMutation.isPending}
                  style={{ fontSize: 12 }}
                >
                  <Sparkles size={12} />
                  {researchMutation.isPending ? "Researching…" : "Research this person"}
                </button>
              </div>
            )}
          </div>

          {/* Intelligence snippets */}
          {intelData?.results && intelData.results.length > 0 && (
            <div>
              <SectionLabel>Intelligence Snippets</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {intelData.results.slice(0, 3).map((chunk) => (
                  <div
                    key={chunk.id}
                    className="v3-card v3-card-tint-indigo"
                    style={{ padding: 12 }}
                  >
                    {chunk.title && (
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--v3-accent-blue)",
                          marginBottom: 4,
                        }}
                      >
                        {chunk.title}
                      </p>
                    )}
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--v3-text-secondary)",
                        margin: 0,
                        lineHeight: 1.6,
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent threads */}
          {threadsData?.threads && threadsData.threads.length > 0 && (
            <div>
              <SectionLabel>Recent Threads</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {threadsData.threads.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="v3-card"
                    style={{
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--v3-text-primary)",
                          margin: 0,
                          marginBottom: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.subject || "(no subject)"}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--v3-text-tertiary)",
                          margin: 0,
                        }}
                      >
                        {t.lastMessageAt
                          ? new Date(t.lastMessageAt).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                    {t.businessCategory && (
                      <span
                        className="v3-badge v3-badge-default"
                        style={{ flexShrink: 0, fontSize: 10 }}
                      >
                        {t.businessCategory}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ── Utility ────────────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
      <span style={{ color: "var(--v3-text-ghost)", marginTop: 1, flexShrink: 0 }}>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: 10,
            color: "var(--v3-text-ghost)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: 12,
            color: "var(--v3-text-secondary)",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
