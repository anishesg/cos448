"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Handshake,
  Plus,
  ArrowUpDown,
  Settings,
  Search,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

interface Lead {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  revenuePotential: string | null;
  fitScore: number | null;
  relationshipType: string | null;
  stage: string;
  recentThreads: Array<{ id: string; subject: string | null; currentState: string | null }>;
  researchSummary: string | null;
}

function useLeads() {
  return useQuery<{ leads: Lead[] }>({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/leads");
      if (!res.ok) return { leads: [] };
      return res.json();
    },
  });
}

const stageLabels: Record<string, string> = {
  new_lead: "New Lead",
  engaged: "Engaged",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const stageColors: Record<string, string> = {
  new_lead: "v3-badge-blue",
  engaged: "v3-badge-green",
  qualified: "v3-badge-purple",
  proposal: "v3-badge-amber",
  negotiation: "v3-badge-amber",
  closed_won: "v3-badge-green",
  closed_lost: "v3-badge-red",
};

const stageAccents: Record<string, string> = {
  new_lead: "var(--v3-accent-blue)",
  engaged: "var(--v3-accent-green)",
  qualified: "var(--v3-accent-purple)",
  proposal: "var(--v3-accent-amber)",
  negotiation: "var(--v3-accent-amber)",
  closed_won: "var(--v3-accent-green)",
  closed_lost: "var(--v3-accent-red)",
};

type SortField = "name" | "stage" | "revenue" | "fitScore";
type SortDir = "asc" | "desc";

const stageOrder = ["new_lead","engaged","qualified","proposal","negotiation","closed_won","closed_lost"];

export default function V3DealsPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useLeads();
  const [sortField, setSortField] = useState<SortField>("stage");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const cycleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const leads = (data?.leads ?? [])
    .filter(l => !search || (l.name || l.email).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "stage") return (stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)) * dir;
      if (sortField === "revenue") return ((Number(a.revenuePotential) || 0) - (Number(b.revenuePotential) || 0)) * dir;
      if (sortField === "fitScore") return ((a.fitScore ?? -1) - (b.fitScore ?? -1)) * dir;
      return (a.name || a.email).localeCompare(b.name || b.email) * dir;
    });

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <span className="v3-record-dot deals" style={{ width: 10, height: 10 }} />
            Deals
          </span>
        </div>
        <div className="v3-page-header-right">
          <button className="v3-btn-primary">
            <Plus size={14} />
            New deal
          </button>
        </div>
      </div>

      <div className="v3-toolbar">
        <button className={`v3-toolbar-btn ${sortField === "stage" ? "active" : ""}`} onClick={() => cycleSort("stage")}>
          <ArrowUpDown size={12} />
          Stage {sortField === "stage" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button className={`v3-toolbar-btn ${sortField === "revenue" ? "active" : ""}`} onClick={() => cycleSort("revenue")}>
          Revenue {sortField === "revenue" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button className={`v3-toolbar-btn ${sortField === "fitScore" ? "active" : ""}`} onClick={() => cycleSort("fitScore")}>
          Fit Score {sortField === "fitScore" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          {searchOpen && (
            <input
              className="v3-input"
              placeholder="Search deals…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              style={{ width: 180, height: 28, fontSize: 12 }}
            />
          )}
          <button className="v3-topbar-btn-icon" onClick={() => { setSearchOpen(o => !o); setSearch(""); }}>
            <Search size={14} />
          </button>
          <button className="v3-toolbar-btn">
            <Settings size={12} />
            View
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading...</div>
      ) : isError ? (
        <div className="v3-empty-state">
          <AlertCircle size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
          <h3>Failed to load deals</h3>
          <p>Something went wrong. Please try refreshing.</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="v3-empty-state">
          <div style={{ width: 80, height: 80, marginBottom: 20, opacity: 0.15 }}>
            <Handshake size={80} strokeWidth={0.8} />
          </div>
          <h3>Deals</h3>
          <p>No deals yet. Leads from your inbox will appear here as deals.</p>
        </div>
      ) : (
        <table className="v3-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Company</th>
              <th>Stage</th>
              <th>Revenue Potential</th>
              <th>Fit Score</th>
              <th>Threads</th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                style={{
                  cursor: "pointer",
                  borderLeft: `3px solid ${stageAccents[lead.stage] || "transparent"}`,
                }}
                onClick={() =>
                  lead.recentThreads[0] && router.push(`/v3/threads/${lead.recentThreads[0].id}`)
                }
              >
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="v3-avatar v3-avatar-sm" style={{ background: "var(--v3-accent-orange)" }}>
                      {(lead.name || lead.email)?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>
                      {lead.name || lead.email}
                    </span>
                  </div>
                </td>
                <td>{lead.company || "—"}</td>
                <td>
                  <span className={`v3-badge ${stageColors[lead.stage] || "v3-badge-default"}`}>
                    {stageLabels[lead.stage] || lead.stage.replace(/_/g, " ")}
                  </span>
                </td>
                <td>
                  {lead.revenuePotential
                    ? `$${Number(lead.revenuePotential).toLocaleString()}`
                    : "—"}
                </td>
                <td>
                  {lead.fitScore != null && (
                    <span className={`v3-badge ${lead.fitScore >= 70 ? "v3-badge-green" : "v3-badge-default"}`}>
                      {lead.fitScore}
                    </span>
                  )}
                </td>
                <td>{lead.recentThreads.length}</td>
                <td>
                  <ChevronRight size={14} className="v3-row-action" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
