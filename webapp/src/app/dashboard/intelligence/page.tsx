"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Search,
  Globe,
  TrendingUp,
  Building,
  Clock,
  Send,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";

interface KnowledgeChunk {
  id: string;
  sourceType: string;
  title: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface KnowledgeSource {
  id: string;
  sourceType: string;
  sourceUrl: string | null;
  title: string | null;
  status: string | null;
  lastScrapedAt: string | null;
  createdAt: string;
}

interface SearchResult {
  id: string;
  title: string | null;
  content: string;
  sourceType: string;
  similarity: number;
}

function useIntelligence() {
  return useQuery<{ sources: KnowledgeSource[]; chunks: KnowledgeChunk[] }>({
    queryKey: ["intelligence"],
    queryFn: async () => {
      const res = await fetch("/api/intelligence");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

function useIntelligenceSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const mutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch(`/api/intelligence?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => setResults(data.results ?? []),
  });
  return { results, search: mutation.mutate, isSearching: mutation.isPending };
}

function useResearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intelligence"] }),
  });
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  contact_research: <Building className="h-3 w-3" />,
  competitor: <TrendingUp className="h-3 w-3" />,
  opportunity: <Sparkles className="h-3 w-3" />,
  email: <Send className="h-3 w-3" />,
};

const SOURCE_COLORS: Record<string, string> = {
  contact_research: "bg-blue-50 text-blue-700",
  competitor: "bg-amber-50 text-amber-700",
  opportunity: "bg-emerald-50 text-emerald-700",
  email: "bg-stone-100 text-stone-600",
};

export default function IntelligencePage() {
  const { data, isLoading } = useIntelligence();
  const { results: searchResults, search, isSearching } = useIntelligenceSearch();
  const researchMutation = useResearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [researchInput, setResearchInput] = useState("");
  const [researchType, setResearchType] = useState<"competitor" | "opportunity">("competitor");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) search(searchQuery);
  };

  const handleResearch = () => {
    if (!researchInput.trim()) return;
    if (researchType === "competitor") {
      researchMutation.mutate({ type: "competitor", name: researchInput });
    } else {
      researchMutation.mutate({
        type: "opportunity",
        industry: "consulting",
        keywords: [researchInput],
      });
    }
  };

  const chunks = data?.chunks ?? [];
  const sources = data?.sources ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-stone-900">
          Business Intelligence
        </h1>
      </div>

      {/* RAG Search */}
      <Card className="border-stone-200 shadow-none">
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-medium text-stone-700 flex items-center gap-2">
            <Search className="h-4 w-4 text-indigo-600" />
            Knowledge Search
          </h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask anything about your contacts, competitors, or industry..."
              className="text-sm"
            />
            <Button type="submit" disabled={isSearching} size="sm">
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </form>

          {searchResults.length > 0 && (
            <div className="space-y-2 mt-3">
              {searchResults.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-stone-100 p-3 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${SOURCE_COLORS[r.sourceType] ?? "bg-stone-100 text-stone-600"}`}>
                      {r.sourceType.replace(/_/g, " ")}
                    </Badge>
                    {r.title && (
                      <span className="text-xs font-medium text-stone-700">
                        {r.title}
                      </span>
                    )}
                    <span className="text-[10px] text-stone-400 ml-auto">
                      {Math.round(r.similarity * 100)}% match
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed line-clamp-4">
                    {r.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Research Trigger */}
      <Card className="border-stone-200 shadow-none">
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-medium text-stone-700 flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-600" />
            Web Research
          </h2>
          <div className="flex gap-2">
            <select
              value={researchType}
              onChange={(e) => setResearchType(e.target.value as "competitor" | "opportunity")}
              className="border border-stone-200 rounded-md px-2 py-1.5 text-sm bg-white"
            >
              <option value="competitor">Competitor</option>
              <option value="opportunity">Opportunity</option>
            </select>
            <Input
              value={researchInput}
              onChange={(e) => setResearchInput(e.target.value)}
              placeholder={
                researchType === "competitor"
                  ? "Competitor name..."
                  : "Topic or keyword..."
              }
              className="text-sm"
            />
            <Button
              onClick={handleResearch}
              disabled={researchMutation.isPending}
              size="sm"
            >
              {researchMutation.isPending ? "Researching..." : "Research"}
            </Button>
          </div>
          {researchMutation.data?.summary && (
            <div className="rounded-lg bg-stone-50 border border-stone-100 p-3">
              <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
                {researchMutation.data.summary}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Recent Intelligence */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-stone-700">
          Recent Intelligence
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : chunks.length === 0 ? (
          <Card className="border-stone-200 shadow-none">
            <CardContent className="py-12 text-center space-y-2">
              <Database className="h-8 w-8 text-stone-300 mx-auto" />
              <p className="text-sm text-stone-500">
                No intelligence yet. Sync emails and run research to build your
                knowledge base.
              </p>
            </CardContent>
          </Card>
        ) : (
          chunks.map((chunk) => (
            <Card
              key={chunk.id}
              className="border-stone-200 shadow-none hover:shadow-sm transition-all"
            >
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  {SOURCE_ICONS[chunk.sourceType]}
                  <Badge className={`text-[10px] ${SOURCE_COLORS[chunk.sourceType] ?? "bg-stone-100 text-stone-600"}`}>
                    {chunk.sourceType.replace(/_/g, " ")}
                  </Badge>
                  {chunk.title && (
                    <span className="text-xs font-medium text-stone-700 truncate">
                      {chunk.title}
                    </span>
                  )}
                  {chunk.createdAt && (
                    <span className="text-[10px] text-stone-400 ml-auto flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(chunk.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">
                  {chunk.content}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
