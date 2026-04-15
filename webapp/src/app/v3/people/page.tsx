"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Users,
  AlertCircle,
  Plus,
  Search,
  ArrowUpDown,
  Settings,
  Upload,
  ChevronRight,
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

type SortField = "name" | "lastContact" | "fitScore" | "interactions";
type SortDir = "asc" | "desc";

export default function V3PeoplePage() {
  const router = useRouter();
  const { data, isLoading, isError } = useContacts();
  const [sortField, setSortField] = useState<SortField>("lastContact");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const cycleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const contacts = (data?.contacts ?? [])
    .filter(c => !search || (c.name || c.email).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "fitScore") return ((a.fitScore ?? -1) - (b.fitScore ?? -1)) * dir;
      if (sortField === "interactions") return (a.totalInteractions - b.totalInteractions) * dir;
      if (sortField === "lastContact") {
        const ta = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
        const tb = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
        return (ta - tb) * dir;
      }
      return (a.name || a.email).localeCompare(b.name || b.email) * dir;
    });

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
        <button className={`v3-toolbar-btn ${sortField === "lastContact" ? "active" : ""}`} onClick={() => cycleSort("lastContact")}>
          <ArrowUpDown size={12} />
          Last contact {sortField === "lastContact" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button className={`v3-toolbar-btn ${sortField === "name" ? "active" : ""}`} onClick={() => cycleSort("name")}>
          Name {sortField === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button className={`v3-toolbar-btn ${sortField === "fitScore" ? "active" : ""}`} onClick={() => cycleSort("fitScore")}>
          Fit Score {sortField === "fitScore" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          {searchOpen && (
            <input
              className="v3-input"
              placeholder="Search people…"
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
        <div style={{ padding: 24, textAlign: "center", color: "var(--v3-text-tertiary)" }}>Loading contacts...</div>
      ) : isError ? (
        <div className="v3-empty-state">
          <AlertCircle size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <h3>Failed to load contacts</h3>
          <p>Something went wrong. Please try refreshing.</p>
        </div>
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
              <th>Role</th>
              <th>Relationship</th>
              <th>Fit Score</th>
              <th>Interactions</th>
              <th>Last Contact</th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr
                key={c.id}
                style={{ cursor: "pointer" }}
                onClick={() => router.push(`/v3/threads?contact=${c.id}`)}
              >
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
                <td style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>{c.role || "—"}</td>
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
