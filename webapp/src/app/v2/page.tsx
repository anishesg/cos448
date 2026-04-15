"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowUpRight,
  EyeOff,
  Sparkles,
  Zap,
  MessageSquare,
  Flame,
  CalendarDays,
} from "lucide-react";
import { V2Button } from "@/components/v2/ui/v2-button";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";
import { StatCard } from "@/components/v2/stat-card";
import { TodayBarV2 } from "@/components/v2/today-bar-v2";
import { FeedSectionV2 } from "@/components/v2/feed-section-v2";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/v2/motion-wrapper";
import type { EmailThreadData } from "@/components/v2/thread-card-v2";

function useEmailThreads() {
  return useQuery<{ threads: EmailThreadData[] }>({
    queryKey: ["emails"],
    queryFn: async () => {
      const res = await fetch("/api/emails?limit=50");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

function useSyncEmails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/emails/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
  });
}

function useClassifyEmails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/emails/classify", { method: "POST" });
      if (!res.ok) throw new Error("Classify failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emails"] }),
  });
}

function groupThreadsByBusinessMeaning(threads: EmailThreadData[]) {
  const groups = {
    needs_you: [] as EmailThreadData[],
    can_handle: [] as EmailThreadData[],
    waiting: [] as EmailThreadData[],
    potential_revenue: [] as EmailThreadData[],
    hidden: [] as EmailThreadData[],
  };

  for (const t of threads) {
    if (t.currentState === "hidden") { groups.hidden.push(t); continue; }
    const cat = t.businessCategory;
    const urgency = t.urgency;
    const action = t.classification?.recommendedAction;

    if (action === "escalate" || action === "notify_founder") groups.needs_you.push(t);
    else if (urgency === "critical" || urgency === "high" || cat === "lead") groups.needs_you.push(t);
    else if (action === "auto_handle" || cat === "scheduling" || cat === "admin") groups.can_handle.push(t);
    else if (t.lastMessageDirection === "outbound") groups.waiting.push(t);
    else if (cat === "active_client" || cat === "payment") groups.potential_revenue.push(t);
    else if (cat === "noise" || !cat) groups.hidden.push(t);
    else groups.potential_revenue.push(t);
  }
  return groups;
}

export default function V2DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useEmailThreads();
  const syncMutation = useSyncEmails();
  const classifyMutation = useClassifyEmails();
  const handleSelectThread = (id: string) => router.push(`/v2/threads/${id}`);

  const threads = data?.threads ?? [];
  const groups = groupThreadsByBusinessMeaning(threads);
  const unclassifiedCount = threads.filter((t) => !t.classification).length;

  const hotLeads = threads.filter((t) => t.businessCategory === "lead" && t.urgency !== "low").length;
  const clientRisks = threads.filter(
    (t) => t.businessCategory === "active_client" && (t.urgency === "high" || t.urgency === "critical")
  ).length;
  const draftsReady = threads.filter((t) => t.currentState === "draft_ready").length;
  const schedulingOpps = threads.filter(
    (t) => t.businessCategory === "scheduling" || t.agentObjective === "schedule_meeting"
  ).length;

  return (
    <PageTransition>
      <div className="mx-auto max-w-[980px] px-8 py-10 space-y-10">
        {/* Page header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="v2-text-gradient text-[32px] font-bold tracking-[-0.02em]">
              Dashboard
            </h1>
            <p className="mt-2 text-[13px] font-medium text-[var(--v2-text-ghost)]">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {threads.length === 0 && !isLoading && (
              <V2Button
                variant="outline"
                color="green"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                {syncMutation.isPending ? "Syncing..." : "Sync Gmail"}
              </V2Button>
            )}
            {unclassifiedCount > 0 && (
              <V2Button
                variant="outline"
                color="purple"
                size="sm"
                onClick={() => classifyMutation.mutate()}
                disabled={classifyMutation.isPending}
              >
                <Sparkles className={`h-3.5 w-3.5 ${classifyMutation.isPending ? "animate-pulse" : ""}`} />
                {classifyMutation.isPending ? "Classifying..." : `Classify ${unclassifiedCount}`}
              </V2Button>
            )}
          </div>
        </div>

        {/* Stat cards */}
        <StaggerContainer className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              icon={MessageSquare}
              label="Active Threads"
              value={threads.filter((t) => t.currentState !== "hidden").length}
              accent="green"
              detail={`${groups.needs_you.length} need attention`}
              miniBar={[3, 5, 4, 7, 6, 8, threads.length || 1]}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              icon={Flame}
              label="Hot Leads"
              value={hotLeads}
              accent="amber"
              detail={hotLeads > 0 ? "Warm opportunities active" : "No active leads"}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              icon={Sparkles}
              label="Drafts Ready"
              value={draftsReady}
              accent="purple"
              detail={draftsReady > 0 ? "Ready for your review" : "All clear"}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              icon={CalendarDays}
              label="To Schedule"
              value={schedulingOpps}
              accent="cyan"
              detail={schedulingOpps > 0 ? "Meetings waiting to book" : "Calendar clear"}
            />
          </StaggerItem>
        </StaggerContainer>

        {/* Today bar */}
        <TodayBarV2
          hotLeads={hotLeads}
          clientRisks={clientRisks}
          repliesReady={threads.filter(
            (t) => t.classification?.recommendedAction === "draft_response" && t.currentState !== "draft_ready"
          ).length}
          hiddenThreads={groups.hidden.length}
          draftsReady={draftsReady}
          schedulingOpportunities={schedulingOpps}
        />

        {/* Feed */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <V2Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl py-28 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {/* Ambient gradient blobs inside card */}
            <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-gradient-to-b from-[rgba(0,232,123,0.06)] to-transparent blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-64 rounded-full bg-gradient-to-t from-[rgba(168,85,247,0.04)] to-transparent blur-3xl" />

            <div className="relative z-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00e87b] via-[#00d4a0] to-[#00d4ff] shadow-[0_0_32px_rgba(0,232,123,0.2)]">
                <Zap className="h-7 w-7 text-[#08080f]" strokeWidth={2} />
              </div>
              <h2 className="v2-text-gradient mt-6 text-[20px] font-bold tracking-[-0.01em]">
                Welcome to ClientOps
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-[var(--v2-text-tertiary)]">
                Sync your Gmail to get started. We&apos;ll analyze your inbox
                and surface what matters for your business.
              </p>
              <div className="mt-8">
                <V2Button
                  variant="solid"
                  color="green"
                  size="lg"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Syncing..." : "Sync Gmail"}
                </V2Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            <FeedSectionV2
              title="Needs You Now"
              icon={<AlertTriangle className="h-3.5 w-3.5 text-[#ff4060]" strokeWidth={2.5} />}
              threads={groups.needs_you}
              onSelectThread={handleSelectThread}
            />
            <FeedSectionV2
              title="I Can Handle"
              icon={<RefreshCw className="h-3.5 w-3.5 text-[#00e87b]" strokeWidth={2} />}
              threads={groups.can_handle}
              onSelectThread={handleSelectThread}
            />
            <FeedSectionV2
              title="Waiting On Others"
              icon={<Clock className="h-3.5 w-3.5 text-[#ffb800]" strokeWidth={2} />}
              threads={groups.waiting}
              onSelectThread={handleSelectThread}
            />
            <FeedSectionV2
              title="Potential Revenue"
              icon={<ArrowUpRight className="h-3.5 w-3.5 text-[#a855f7]" strokeWidth={2} />}
              threads={groups.potential_revenue}
              onSelectThread={handleSelectThread}
            />
            <FeedSectionV2
              title="Hidden Noise"
              icon={<EyeOff className="h-3.5 w-3.5 text-[var(--v2-text-ghost)]" strokeWidth={2} />}
              threads={groups.hidden}
              defaultCollapsed
              onSelectThread={handleSelectThread}
            />
          </div>
        )}
      </div>
    </PageTransition>
  );
}
