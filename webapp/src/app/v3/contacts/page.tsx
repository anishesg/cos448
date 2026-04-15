"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
  Settings,
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

export default function V3CompaniesPage() {
  const { data, isLoading } = useContacts();
  const contacts = data?.contacts ?? [];

  const companies = new Map<string, { name: string; contacts: Contact[] }>();
  for (const c of contacts) {
    const domain = c.email.split("@")[1] || "unknown";
    const companyName = c.company || domain;
    if (!companies.has(companyName)) {
      companies.set(companyName, { name: companyName, contacts: [] });
    }
    companies.get(companyName)!.contacts.push(c);
  }
  const companyList = Array.from(companies.values());

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
        <button className="v3-toolbar-btn active">
          <ArrowUpDown size={12} />
          Sorted by Name
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
                        style={{ background: "var(--v3-accent-blue)", borderRadius: 4 }}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
