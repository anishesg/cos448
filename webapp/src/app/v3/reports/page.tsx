"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart3,
  Plus,
  Search,
  Settings,
  ArrowUpDown,
  Star,
  PieChart,
  TrendingUp,
} from "lucide-react";

interface Dashboard {
  id: string;
  name: string;
  reports: string[];
  createdAt: string;
}

function useIntelligenceStats() {
  return useQuery<{ sources: number; chunks: number }>({
    queryKey: ["intelligence-stats"],
    queryFn: async () => {
      const res = await fetch("/api/intelligence?action=list_sources");
      if (!res.ok) return { sources: 0, chunks: 0 };
      const data = await res.json();
      return { sources: data.sources?.length ?? 0, chunks: data.chunks?.length ?? 0 };
    },
  });
}

export default function V3ReportsPage() {
  const { data: stats } = useIntelligenceStats();
  const [dashboards] = useState<Dashboard[]>([
    {
      id: "1",
      name: "Companies by Country",
      reports: ["Companies by Country Count"],
      createdAt: new Date().toISOString(),
    },
  ]);

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <BarChart3 size={16} />
            Reports
          </span>
        </div>
        <div className="v3-page-header-right">
          <span style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>Help</span>
          <button className="v3-btn-primary">
            <Plus size={14} />
            New dashboard
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="v3-toolbar">
        <button className="v3-toolbar-btn active">
          <ArrowUpDown size={12} />
          Sorted by Creation date
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button className="v3-topbar-btn-icon">
            <Search size={14} />
          </button>
          <button className="v3-toolbar-btn">View settings</button>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {/* Favorites section */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--v3-text-tertiary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Favorites
          </h3>
          <div className="v3-favorites-empty">
            <Star size={20} style={{ opacity: 0.3, marginBottom: 8, margin: "0 auto 8px" }} />
            <p>Dashboards that you favorite will appear here</p>
          </div>
        </div>

        {/* Dashboards table */}
        <table className="v3-table">
          <thead>
            <tr>
              <th>Dashboard</th>
              <th>Reports</th>
              <th>Created at</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} style={{ padding: "8px 16px" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--v3-text-tertiary)" }}>
                  Created today <span className="v3-badge v3-badge-default" style={{ marginLeft: 6 }}>{dashboards.length}</span>
                </span>
              </td>
            </tr>
            {dashboards.map((dash) => (
              <tr key={dash.id} style={{ cursor: "pointer" }}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: "linear-gradient(135deg, #ef4444, #f97316)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <PieChart size={12} color="white" />
                    </div>
                    <span style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>
                      {dash.name}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--v3-text-ghost)" }}>ⓘ</span>
                  </div>
                </td>
                <td>
                  <span className="v3-badge v3-badge-blue">
                    <TrendingUp size={10} />
                    {dash.reports[0]}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>Today</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
