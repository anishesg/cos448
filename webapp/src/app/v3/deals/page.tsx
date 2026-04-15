"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Handshake,
  Plus,
  ArrowUpDown,
  SlidersHorizontal,
  Settings,
  Search,
} from "lucide-react";

interface Lead {
  contact: {
    id: string;
    name: string;
    email: string;
    company: string;
    revenuePotential: string | null;
    fitScore: number | null;
  };
  stage: string;
  threads: Array<{ id: string; subject: string }>;
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

export default function V3DealsPage() {
  const router = useRouter();
  const { data, isLoading } = useLeads();
  const leads = data?.leads ?? [];

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
        <button className="v3-toolbar-btn active">
          <ArrowUpDown size={12} />
          Sorted by Stage
        </button>
        <button className="v3-toolbar-btn">
          <SlidersHorizontal size={12} />
          Filter
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button className="v3-topbar-btn-icon">
            <Search size={14} />
          </button>
          <button className="v3-toolbar-btn">
            <Settings size={12} />
            View settings
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading...</div>
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
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.contact.id}
                style={{ cursor: "pointer" }}
                onClick={() =>
                  lead.threads[0] && router.push(`/v3/threads/${lead.threads[0].id}`)
                }
              >
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="v3-avatar v3-avatar-sm" style={{ background: "var(--v3-accent-orange)" }}>
                      {lead.contact.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>
                      {lead.contact.name || lead.contact.email}
                    </span>
                  </div>
                </td>
                <td>{lead.contact.company || "—"}</td>
                <td>
                  <span className={`v3-badge ${stageColors[lead.stage] || "v3-badge-default"}`}>
                    {stageLabels[lead.stage] || lead.stage}
                  </span>
                </td>
                <td>
                  {lead.contact.revenuePotential
                    ? `$${Number(lead.contact.revenuePotential).toLocaleString()}`
                    : "—"}
                </td>
                <td>
                  {lead.contact.fitScore != null && (
                    <span className={`v3-badge ${lead.contact.fitScore >= 70 ? "v3-badge-green" : "v3-badge-default"}`}>
                      {lead.contact.fitScore}
                    </span>
                  )}
                </td>
                <td>{lead.threads.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
