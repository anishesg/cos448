"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  Plus,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  Settings,
  ChevronRight,
} from "lucide-react";

interface Contact {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
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

type SortField = "name" | "people";
type SortDir = "asc" | "desc";

export default function V3CompaniesPage() {
  const { data, isLoading, isError } = useContacts();
  const contacts = data?.contacts ?? [];
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const cycleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const companies = new Map<string, { name: string; contacts: Contact[] }>();
  for (const c of contacts) {
    const domain = c.email.split("@")[1] || "unknown";
    const companyName = c.company || domain;
    if (!companies.has(companyName)) {
      companies.set(companyName, { name: companyName, contacts: [] });
    }
    companies.get(companyName)!.contacts.push(c);
  }
  let companyList = Array.from(companies.values())
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "people") return (a.contacts.length - b.contacts.length) * dir;
      return a.name.localeCompare(b.name) * dir;
    });

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <span className="v3-record-dot companies" style={{ width: 10, height: 10 }} />
            Companies
          </span>
        </div>
        <div className="v3-page-header-right">
          <button className="v3-btn-primary">
            <Plus size={14} />
            New company
          </button>
        </div>
      </div>

      <div className="v3-toolbar">
        <button className={`v3-toolbar-btn ${sortField === "name" ? "active" : ""}`} onClick={() => cycleSort("name")}>
          <ArrowUpDown size={12} />
          Name {sortField === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <button className={`v3-toolbar-btn ${sortField === "people" ? "active" : ""}`} onClick={() => cycleSort("people")}>
          People {sortField === "people" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          {searchOpen && (
            <input
              className="v3-input"
              placeholder="Search companies…"
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
          <Building2 size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
          <h3>Failed to load companies</h3>
          <p>Something went wrong. Please try refreshing.</p>
        </div>
      ) : companyList.length === 0 ? (
        <div className="v3-empty-state">
          <div style={{ width: 80, height: 80, marginBottom: 20, opacity: 0.15 }}>
            <Building2 size={80} strokeWidth={0.8} />
          </div>
          <h3>Companies</h3>
          <p>No companies yet. Sync your inbox to discover companies.</p>
        </div>
      ) : (
        <table className="v3-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>People</th>
              <th>Domain</th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {companyList.map((company) => {
              const domain = company.contacts[0]?.email.split("@")[1] || "";
              return (
                <tr key={company.name} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        className="v3-avatar v3-avatar-sm"
                        style={{ background: "var(--v3-accent-blue)", borderRadius: "var(--v3-radius-sm)" }}
                      >
                        {company.name[0]?.toUpperCase() || "?"}
                      </div>
                      <span style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>
                        {company.name}
                      </span>
                    </div>
                  </td>
                  <td>{company.contacts.length}</td>
                  <td style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>{domain}</td>
                  <td>
                    <ChevronRight size={14} className="v3-row-action" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
