"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sun, Moon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { V2Card, V2CardContent } from "@/components/v2/ui/v2-card";
import { V2Button } from "@/components/v2/ui/v2-button";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";
import { PageTransition } from "@/components/v2/motion-wrapper";

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

export default function V2BriefingPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ briefings: Briefing[] }>({
    queryKey: ["briefings"],
    queryFn: async () => {
      const res = await fetch("/api/briefings");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const generateMutation = useMutation({
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

  const briefings = data?.briefings ?? [];
  const currentHour = new Date().getHours();
  const suggestedType: "morning" | "evening" =
    currentHour < 14 ? "morning" : "evening";

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] space-y-8 px-8 py-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {suggestedType === "morning" ? (
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                  "bg-gradient-to-br from-[#ffb800] to-[#ff4060]",
                  "shadow-[0_0_24px_rgba(255,184,0,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]"
                )}
              >
                <Sun className="h-5 w-5 text-[#08080f]" strokeWidth={2.25} />
              </div>
            ) : (
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                  "bg-gradient-to-br from-[#a855f7] to-[#00d4ff]",
                  "shadow-[0_0_24px_rgba(168,85,247,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]"
                )}
              >
                <Moon className="h-5 w-5 text-[#08080f]" strokeWidth={2.25} />
              </div>
            )}
            <h1 className="v2-text-gradient truncate text-[24px] font-bold tracking-[-0.02em]">
              Founder Briefing
            </h1>
          </div>

          <V2Button
            variant="outline"
            color={suggestedType === "morning" ? "amber" : "purple"}
            size="sm"
            onClick={() => generateMutation.mutate(suggestedType)}
            disabled={generateMutation.isPending}
            className="shrink-0"
          >
            <Sparkles
              className={cn(
                "h-3.5 w-3.5",
                generateMutation.isPending && "animate-pulse"
              )}
            />
            {generateMutation.isPending
              ? "Generating..."
              : `Generate ${suggestedType} briefing`}
          </V2Button>
        </div>

        {isLoading ? (
          <V2Skeleton className="h-96 w-full rounded-2xl" />
        ) : briefings.length === 0 ? (
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)]",
              "bg-[rgba(255,255,255,0.025)] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute -top-28 left-1/2 h-56 w-[140%] -translate-x-1/2",
                "rounded-full bg-gradient-to-r from-[#00e87b]/25 via-[#a855f7]/20 to-[#00d4ff]/25 blur-3xl"
              )}
            />
            <div className="relative flex flex-col items-center px-6 py-20 text-center">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-[10px]",
                  "bg-gradient-to-br from-[#ffb800] to-[#ff4060]",
                  "shadow-[0_0_28px_rgba(255,184,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]"
                )}
              >
                <Sun className="h-7 w-7 text-[#08080f]" strokeWidth={2.25} />
              </div>
              <h2 className="v2-text-gradient mt-4 text-[16px] font-semibold tracking-[-0.01em]">
                No briefings yet
              </h2>
              <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-[color:var(--v2-text-secondary)]">
                Generate your first briefing to see a calm, concise summary of
                what matters in your business today.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {briefings.map((briefing) => (
              <V2Card key={briefing.id} hover={false}>
                <V2CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {briefing.type === "morning" ? (
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-[10px]",
                          "bg-gradient-to-br from-[#ffb800] to-[#ff4060]",
                          "shadow-[0_0_18px_rgba(255,184,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]"
                        )}
                      >
                        <Sun
                          className="h-4 w-4 text-[#08080f]"
                          strokeWidth={2.25}
                        />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-[10px]",
                          "bg-gradient-to-br from-[#a855f7] to-[#00d4ff]",
                          "shadow-[0_0_18px_rgba(168,85,247,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]"
                        )}
                      >
                        <Moon
                          className="h-4 w-4 text-[#08080f]"
                          strokeWidth={2.25}
                        />
                      </div>
                    )}
                    <V2Badge
                      color={
                        briefing.type === "morning" ? "amber" : "purple"
                      }
                    >
                      {briefing.type}
                    </V2Badge>
                    <span className="text-[11px] text-[color:var(--v2-text-tertiary)]">
                      {format(
                        new Date(briefing.generatedAt),
                        "EEEE, MMMM d · h:mm a"
                      )}
                    </span>
                  </div>

                  {briefing.content.stats && (
                    <div
                      className={cn(
                        "flex flex-wrap gap-x-10 gap-y-2 border-y border-[rgba(255,255,255,0.04)] py-3.5 text-[11px]"
                      )}
                    >
                      <span className="text-[color:var(--v2-text-tertiary)]">
                        <span className="font-semibold tabular-nums text-[color:var(--v2-text-primary)]">
                          {briefing.content.stats.actionsHandled}
                        </span>{" "}
                        handled
                      </span>
                      <span className="text-[color:var(--v2-text-tertiary)]">
                        <span className="font-semibold tabular-nums text-[color:var(--v2-text-primary)]">
                          {briefing.content.stats.pendingApprovals}
                        </span>{" "}
                        pending
                      </span>
                      <span className="text-[color:var(--v2-text-tertiary)]">
                        <span className="font-semibold tabular-nums text-[color:var(--v2-text-primary)]">
                          {briefing.content.stats.activeWorkflows}
                        </span>{" "}
                        active loops
                      </span>
                      <span className="text-[color:var(--v2-text-tertiary)]">
                        <span className="font-semibold tabular-nums text-[var(--v2-amber)]">
                          {briefing.content.stats.needsAttention}
                        </span>{" "}
                        need attention
                      </span>
                    </div>
                  )}

                  <div
                    className="text-[13px] leading-[1.7] text-[color:var(--v2-text-secondary)]"
                    dangerouslySetInnerHTML={{
                      __html: briefing.content.markdown.replace(/\n/g, "<br/>"),
                    }}
                  />
                </V2CardContent>
              </V2Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
