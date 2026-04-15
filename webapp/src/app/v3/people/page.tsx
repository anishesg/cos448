"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  Settings,
  Upload,
} from "lucide-react";

interface Contact {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  role: string | null;
  relationshipType: string | null;
  fitScore: number | null;
  lastContactAt: string | null;
  totalInteractions: number;
}

function useContacts() {
  return useQuery<{ contacts: Contact[] }>({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

export default function V3PeoplePage() {
  const router = useRouter();
  const { data, isLoading } = useContacts();
  const contacts = data?.contacts ?? [];

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <span className="v3-record-dot people" style={{ width: 10, height: 10 }} />
            People
          </span>
        </div>
        <div className="v3-page-header-right">
          <button className="v3-topbar-btn-ghost">
            <Upload size={14} />
            Import
          </button>
          <button className="v3-btn-primary">
            <Plus size={14} />
            New person
          </button>
        </div>
      </div>

      <div className="v3-toolbar">
        <button className="v3-toolbar-btn active">
          <ArrowUpDown size={12} />
          Sorted by Last contact
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
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="v3-empty-state">
          <div style={{ width: 80, height: 80, marginBottom: 20, opacity: 0.15 }}>
            <Users size={80} strokeWidth={0.8} />
          </div>
          <h3>People</h3>
          <p>No contacts yet. Sync your inbox to automatically discover people.</p>
        </div>
      ) : (
        <table className="v3-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Relationship</th>
              <th>Fit Score</th>
              <th>Interactions</th>
              <th>Last Contact</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} style={{ cursor: "pointer" }}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="v3-avatar v3-avatar-sm" style={{ background: "var(--v3-accent-green)" }}>
                      {(c.name || c.email)[0].toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>
                      {c.name || c.email}
                    </span>
                  </div>
                </td>
                <td style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>{c.email}</td>
                <td>{c.company || "—"}</td>
                <td>
                  {c.relationshipType && (
                    <span className="v3-badge v3-badge-default">{c.relationshipType}</span>
                  )}
                </td>
                <td>
                  {c.fitScore != null && (
                    <span className={`v3-badge ${c.fitScore >= 70 ? "v3-badge-green" : c.fitScore >= 40 ? "v3-badge-amber" : "v3-badge-default"}`}>
                      {c.fitScore}
                    </span>
                  )}
                </td>
                <td>{c.totalInteractions}</td>
                <td style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>
                  {c.lastContactAt ? new Date(c.lastContactAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
