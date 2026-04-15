"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sun, Moon, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Briefing {
  id: string;
  type: "morning" | "evening";
  content: {
    markdown: string;
    stats?: {
      actionsHandled: number;
      pendingApprovals: number;
      activeWorkflows: number;
      needsAttention: number;
    };
  };
  generatedAt: string;
}

function useBriefings() {
  return useQuery<{ briefings: Briefing[] }>({
    queryKey: ["briefings"],
    queryFn: async () => {
      const res = await fetch("/api/briefings");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

function useGenerateBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (type: "morning" | "evening") => {
      const res = await fetch("/api/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["briefings"] }),
  });
}

export default function BriefingPage() {
  const { data, isLoading } = useBriefings();
  const generateMutation = useGenerateBriefing();
  const briefings = data?.briefings ?? [];

  const currentHour = new Date().getHours();
  const suggestedType = currentHour < 14 ? "morning" : "evening";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {suggestedType === "morning" ? (
            <Sun className="h-5 w-5 text-amber-500" />
          ) : (
            <Moon className="h-5 w-5 text-indigo-500" />
          )}
          <h1 className="text-lg font-semibold text-stone-900">
            Founder Briefing
          </h1>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => generateMutation.mutate(suggestedType as "morning" | "evening")}
          disabled={generateMutation.isPending}
          className="text-xs gap-1.5"
        >
          <Sparkles
            className={`h-3.5 w-3.5 ${generateMutation.isPending ? "animate-pulse" : ""}`}
          />
          {generateMutation.isPending
            ? "Generating..."
            : `Generate ${suggestedType} briefing`}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : briefings.length === 0 ? (
        <Card className="border-stone-200 shadow-none">
          <CardContent className="py-16 text-center space-y-3">
            <Sun className="h-10 w-10 text-stone-300 mx-auto" />
            <h2 className="text-base font-semibold text-stone-900">
              No briefings yet
            </h2>
            <p className="text-sm text-stone-500 max-w-sm mx-auto">
              Generate your first briefing to see a calm, concise summary of
              what matters in your business today.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {briefings.map((briefing) => (
            <Card key={briefing.id} className="border-stone-200 shadow-none">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {briefing.type === "morning" ? (
                      <Sun className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Moon className="h-4 w-4 text-indigo-500" />
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {briefing.type}
                    </Badge>
                    <span className="text-[11px] text-stone-400">
                      {format(
                        new Date(briefing.generatedAt),
                        "EEEE, MMMM d · h:mm a"
                      )}
                    </span>
                  </div>
                </div>

                {/* Stats bar */}
                {briefing.content.stats && (
                  <div className="flex gap-4 text-[11px] text-stone-500 py-1 border-y border-stone-100">
                    <span>
                      <strong>{briefing.content.stats.actionsHandled}</strong>{" "}
                      handled
                    </span>
                    <span>
                      <strong>
                        {briefing.content.stats.pendingApprovals}
                      </strong>{" "}
                      pending
                    </span>
                    <span>
                      <strong>
                        {briefing.content.stats.activeWorkflows}
                      </strong>{" "}
                      active loops
                    </span>
                    <span>
                      <strong>
                        {briefing.content.stats.needsAttention}
                      </strong>{" "}
                      need attention
                    </span>
                  </div>
                )}

                <div className="prose prose-sm prose-stone max-w-none text-xs leading-relaxed">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: briefing.content.markdown.replace(
                        /\n/g,
                        "<br/>"
                      ),
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
