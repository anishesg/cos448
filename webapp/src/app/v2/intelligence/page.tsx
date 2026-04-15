"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Database,
  Search,
  Globe,
  FileText,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/v2/motion-wrapper";
import { V2Button } from "@/components/v2/ui/v2-button";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { V2Input } from "@/components/v2/ui/v2-input";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";

interface KnowledgeChunk {
  id: string;
  sourceType: string;
  title: string | null;
  content: string;
  similarity?: number;
  createdAt: string;
}

const glassCard =
  "rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

const selectClassName =
  "rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-3.5 py-[10px] text-[13px] text-[var(--v2-text-secondary)] outline-none";

export default function V2IntelligencePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeChunk[]>([]);
  const [researchType, setResearchType] = useState("competitor");
  const [researchInput, setResearchInput] = useState("");
  const [researchResult, setResearchResult] = useState("");

  const { data, isLoading } = useQuery<{
    sources: unknown[];
    chunks: KnowledgeChunk[];
  }>({
    queryKey: ["intelligence"],
    queryFn: async () => {
      const res = await fetch("/api/intelligence");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await fetch(`/api/intelligence?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    onSuccess: (data) => setSearchResults(data.results ?? data.chunks ?? []),
  });

  const researchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: researchType, query: researchInput }),
      });
      if (!res.ok) throw new Error("Research failed");
      return res.json();
    },
    onSuccess: (data) => setResearchResult(data.summary ?? ""),
  });

  const chunks = data?.chunks ?? [];

  const sourceIcon: Record<string, typeof Globe> = {
    web: Globe,
    email: FileText,
    research: Zap,
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#a855f7] to-[#ff2d87] shadow-[0_0_24px_rgba(168,85,247,0.45)]">
            <Database className="h-5 w-5 text-white" />
          </div>
          <h1 className="v2-text-gradient text-[24px] font-bold tracking-[-0.02em]">
            Business Intelligence
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className={cn(glassCard, "p-5 space-y-4")}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--v2-text-tertiary)]">
              Knowledge Search
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) searchMutation.mutate(searchQuery);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--v2-text-ghost)]" />
                <V2Input
                  placeholder="Search your knowledge base..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  focusColor="purple"
                />
              </div>
              <V2Button
                type="submit"
                size="md"
                color="purple"
                disabled={searchMutation.isPending}
              >
                {searchMutation.isPending ? "..." : "Search"}
              </V2Button>
            </form>

            {searchResults.length > 0 && (
              <div className="max-h-80 space-y-2 overflow-y-auto v2-scrollbar pr-1">
                {searchResults.map((chunk) => {
                  const Icon = sourceIcon[chunk.sourceType] ?? FileText;
                  return (
                    <div
                      key={chunk.id}
                      className="space-y-1.5 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md"
                    >
                      <div className="flex items-center gap-2">
                        <V2Badge color="purple">
                          <Icon className="h-2.5 w-2.5" />
                          {chunk.sourceType}
                        </V2Badge>
                        {chunk.title && (
                          <span className="min-w-0 truncate text-[12px] font-medium text-[var(--v2-text-primary)]">
                            {chunk.title}
                          </span>
                        )}
                        {chunk.similarity != null && (
                          <span
                            className={cn(
                              "ml-auto text-[10px] font-semibold tabular-nums",
                              chunk.similarity > 0.8
                                ? "text-[#00e87b]"
                                : chunk.similarity > 0.6
                                  ? "text-[#ffb800]"
                                  : "text-[var(--v2-text-tertiary)]"
                            )}
                          >
                            {Math.round(chunk.similarity * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-3 text-[11px] leading-relaxed text-[var(--v2-text-secondary)]">
                        {chunk.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={cn(glassCard, "p-5 space-y-4")}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--v2-text-tertiary)]">
              Web Research
            </h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={researchType}
                onChange={(e) => setResearchType(e.target.value)}
                className={selectClassName}
              >
                <option value="competitor">Competitor</option>
                <option value="opportunity">Opportunity</option>
              </select>
              <V2Input
                placeholder={
                  researchType === "competitor"
                    ? "Company or product name..."
                    : "Describe the opportunity..."
                }
                value={researchInput}
                onChange={(e) => setResearchInput(e.target.value)}
                focusColor="cyan"
                className="min-w-[200px] flex-1"
              />
            </div>
            <V2Button
              color="cyan"
              size="md"
              onClick={() => researchMutation.mutate()}
              disabled={researchMutation.isPending || !researchInput.trim()}
              className="w-full"
            >
              <Globe className="h-3.5 w-3.5" />
              {researchMutation.isPending ? "Researching..." : "Research"}
            </V2Button>

            {researchResult && (
              <div className="rounded-xl border border-[rgba(0,212,255,0.12)] bg-[rgba(0,212,255,0.04)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md">
                <p className="text-[12px] leading-relaxed text-[var(--v2-text-secondary)]">
                  {researchResult}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--v2-text-tertiary)]">
            Recent Intelligence
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <V2Skeleton
                  key={i}
                  className="h-20 w-full rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
                />
              ))}
            </div>
          ) : chunks.length === 0 ? (
            <p className="text-[13px] text-[var(--v2-text-tertiary)]">
              No intelligence gathered yet.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {chunks.slice(0, 8).map((chunk) => {
                const Icon = sourceIcon[chunk.sourceType] ?? FileText;
                return (
                  <div key={chunk.id} className={cn(glassCard, "p-4 space-y-2")}>
                    <div className="flex items-center justify-between gap-2">
                      <V2Badge color="muted">
                        <Icon className="h-2.5 w-2.5" />
                        {chunk.sourceType}
                      </V2Badge>
                      <span className="shrink-0 text-[10px] text-[var(--v2-text-ghost)]">
                        {formatDistanceToNow(new Date(chunk.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {chunk.title && (
                      <p className="text-[13px] font-medium text-[var(--v2-text-primary)]">
                        {chunk.title}
                      </p>
                    )}
                    <p className="line-clamp-3 text-[11px] leading-relaxed text-[var(--v2-text-secondary)]">
                      {chunk.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
