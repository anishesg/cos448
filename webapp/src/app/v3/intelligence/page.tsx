"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Brain,
  Search,
  Database,
  Globe,
  Target,
  Sparkles,
  Loader2,
} from "lucide-react";

interface KnowledgeSource {
  id: string;
  sourceType: string;
  title: string;
  status: string;
}

interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  sourceType: string;
}

function useKnowledge() {
  return useQuery<{ sources: KnowledgeSource[]; chunks: KnowledgeChunk[] }>({
    queryKey: ["intelligence"],
    queryFn: async () => {
      const res = await fetch("/api/intelligence?action=list_sources");
      if (!res.ok) return { sources: [], chunks: [] };
      return res.json();
    },
  });
}

function useIntelligenceSearch() {
  return useMutation({
    mutationFn: async ({ query, type }: { query: string; type: string }) => {
      const res = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: type, query }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

export default function V3IntelligencePage() {
  const { data, isLoading } = useKnowledge();
  const searchMutation = useIntelligenceSearch();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "research" | "opportunities">("search");

  const sources = data?.sources ?? [];
  const chunks = data?.chunks ?? [];

  const handleSearch = () => {
    if (!query.trim()) return;
    const actionMap = {
      search: "search",
      research: "competitor_research",
      opportunities: "find_opportunities",
    };
    searchMutation.mutate({ query, type: actionMap[activeTab] });
  };

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <Brain size={16} />
            Intelligence
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        {/* Search section */}
        <div className="v3-card" style={{ marginBottom: 24 }}>
          <div className="v3-tabs" style={{ padding: 0, borderBottom: "none", marginBottom: 16 }}>
            <button className={`v3-tab ${activeTab === "search" ? "active" : ""}`} onClick={() => setActiveTab("search")}>
              <Search size={14} />
              Knowledge Search
            </button>
            <button className={`v3-tab ${activeTab === "research" ? "active" : ""}`} onClick={() => setActiveTab("research")}>
              <Globe size={14} />
              Competitor Research
            </button>
            <button className={`v3-tab ${activeTab === "opportunities" ? "active" : ""}`} onClick={() => setActiveTab("opportunities")}>
              <Target size={14} />
              Find Opportunities
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="v3-input"
              placeholder={
                activeTab === "search"
                  ? "Search your knowledge base..."
                  : activeTab === "research"
                  ? "Enter competitor name or topic..."
                  : "Describe what opportunities to find..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              style={{ flex: 1 }}
            />
            <button
              className="v3-btn-primary"
              onClick={handleSearch}
              disabled={searchMutation.isPending || !query.trim()}
            >
              {searchMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {searchMutation.isPending ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Results */}
          {searchMutation.data && (
            <div style={{ marginTop: 16, padding: "16px", borderRadius: "var(--v3-radius-md)", background: "var(--v3-bg-input)", border: "1px solid var(--v3-border)" }}>
              <pre style={{ fontSize: 13, color: "var(--v3-text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.7, fontFamily: "inherit" }}>
                {typeof searchMutation.data === "string"
                  ? searchMutation.data
                  : JSON.stringify(searchMutation.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Knowledge sources */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={14} style={{ color: "var(--v3-text-tertiary)" }} />
            Knowledge Sources
            <span className="v3-badge v3-badge-default">{sources.length}</span>
          </h3>
          {sources.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                borderRadius: "var(--v3-radius-lg)",
                border: "1px solid var(--v3-border)",
                background: "var(--v3-bg-surface)",
              }}
            >
              <p style={{ color: "var(--v3-text-tertiary)", fontSize: 13 }}>
                No knowledge sources yet. Sources will be created from research and contact analysis.
              </p>
            </div>
          ) : (
            <table className="v3-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500, color: "var(--v3-text-primary)" }}>{s.title || "Untitled"}</td>
                    <td><span className="v3-badge v3-badge-default">{s.sourceType}</span></td>
                    <td>
                      <span className={`v3-badge ${s.status === "indexed" ? "v3-badge-green" : "v3-badge-amber"}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Knowledge chunks */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            Indexed Chunks
            <span className="v3-badge v3-badge-default">{chunks.length}</span>
          </h3>
          {chunks.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {chunks.slice(0, 10).map((c) => (
                <div key={c.id} className="v3-card" style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{c.title || "Chunk"}</div>
                  <p style={{ fontSize: 12, color: "var(--v3-text-tertiary)", lineHeight: 1.6 }}>
                    {c.content?.slice(0, 200)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
