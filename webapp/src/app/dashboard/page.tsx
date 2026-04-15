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
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TodayBar } from "@/components/feed/today-bar";
import { FeedSection } from "@/components/feed/feed-section";
import type { EmailThreadData } from "@/components/feed/thread-card";

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
    automated: [] as EmailThreadData[],
    needs_you: [] as EmailThreadData[],
    can_handle: [] as EmailThreadData[],
    waiting: [] as EmailThreadData[],
    potential_revenue: [] as EmailThreadData[],
    hidden: [] as EmailThreadData[],
  };

  for (const t of threads) {
    if (t.currentState === "automated") {
      groups.automated.push(t);
      continue;
    }
    if (t.currentState === "hidden") {
      groups.hidden.push(t);
      continue;
    }

    const cat = t.businessCategory;
    const urgency = t.urgency;
    const action = t.classification?.recommendedAction;

    if (action === "escalate" || action === "notify_founder") {
      groups.needs_you.push(t);
    } else if (
      urgency === "critical" ||
      urgency === "high" ||
      cat === "lead"
    ) {
      groups.needs_you.push(t);
    } else if (
      action === "auto_handle" ||
      cat === "scheduling" ||
      cat === "admin"
    ) {
      groups.can_handle.push(t);
    } else if (t.lastMessageDirection === "outbound") {
      groups.waiting.push(t);
    } else if (cat === "active_client" || cat === "payment") {
      groups.potential_revenue.push(t);
    } else if (cat === "noise" || !cat) {
      groups.hidden.push(t);
    } else {
      groups.potential_revenue.push(t);
    }
  }

  return groups;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useEmailThreads();
  const syncMutation = useSyncEmails();
  const classifyMutation = useClassifyEmails();
  const handleSelectThread = (id: string) => router.push(`/dashboard/threads/${id}`);

  const threads = data?.threads ?? [];
  const groups = groupThreadsByBusinessMeaning(threads);

  const unclassifiedCount = threads.filter((t) => !t.classification).length;

  const todayStats = {
    hotLeads: threads.filter(
      (t) => t.businessCategory === "lead" && t.urgency !== "low"
    ).length,
    clientRisks: threads.filter(
      (t) =>
        t.businessCategory === "active_client" &&
        (t.urgency === "high" || t.urgency === "critical")
    ).length,
    repliesReady: threads.filter(
      (t) => t.classification?.recommendedAction === "draft_response" && t.currentState !== "draft_ready"
    ).length,
    calendarConflicts: 0,
    hiddenThreads: groups.hidden.length,
    draftsReady: threads.filter(
      (t) => t.currentState === "draft_ready"
    ).length,
    schedulingOpportunities: threads.filter(
      (t) => t.businessCategory === "scheduling" || t.agentObjective === "schedule_meeting"
    ).length,
  };

  const automatedCount = groups.automated.length;
  const totalLeads = threads.filter((t) => t.businessCategory === "lead").length;
  const totalClients = threads.filter((t) => t.businessCategory === "active_client").length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Quick stats */}
      {threads.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-stone-900">{threads.length}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider">Threads</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-indigo-600">{totalLeads}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider">Leads</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">{totalClients}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider">Clients</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-purple-600">{automatedCount}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider">Automated</p>
          </div>
        </div>
      )}

      <TodayBar {...todayStats} />

      {/* Actions bar */}
      {(threads.length === 0 || unclassifiedCount > 0) && (
        <div className="flex items-center gap-2">
          {threads.length === 0 && !isLoading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="text-xs gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              {syncMutation.isPending ? "Syncing..." : "Sync emails from Gmail"}
            </Button>
          )}
          {unclassifiedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => classifyMutation.mutate()}
              disabled={classifyMutation.isPending}
              className="text-xs gap-1.5"
            >
              <Sparkles
                className={`h-3.5 w-3.5 ${classifyMutation.isPending ? "animate-pulse" : ""}`}
              />
              {classifyMutation.isPending
                ? "Classifying..."
                : `Classify ${unclassifiedCount} threads`}
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Zap className="h-10 w-10 text-stone-300" />
          <h2 className="text-lg font-semibold text-stone-900">
            Welcome to ClientOps
          </h2>
          <p className="text-sm text-stone-500 max-w-sm">
            Sync your Gmail to get started. We&apos;ll analyze your inbox and surface
            what matters for your business.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.automated.length > 0 && (
            <FeedSection
              title="Automation Active"
              icon={<Bot className="h-3.5 w-3.5 text-emerald-500" />}
              threads={groups.automated}
              onSelectThread={handleSelectThread}
            />
          )}
          <FeedSection
            title="Needs You Now"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
            threads={groups.needs_you}
            onSelectThread={handleSelectThread}
          />
          <FeedSection
            title="I Can Handle"
            icon={<RefreshCw className="h-3.5 w-3.5 text-emerald-400" />}
            threads={groups.can_handle}
            onSelectThread={handleSelectThread}
          />
          <FeedSection
            title="Waiting On Others"
            icon={<Clock className="h-3.5 w-3.5 text-amber-400" />}
            threads={groups.waiting}
            onSelectThread={handleSelectThread}
          />
          <FeedSection
            title="Potential Revenue"
            icon={<ArrowUpRight className="h-3.5 w-3.5 text-indigo-400" />}
            threads={groups.potential_revenue}
            onSelectThread={handleSelectThread}
          />
          <FeedSection
            title="Hidden Noise"
            icon={<EyeOff className="h-3.5 w-3.5 text-stone-300" />}
            threads={groups.hidden}
            defaultCollapsed
            onSelectThread={handleSelectThread}
          />
        </div>
      )}
    </div>
  );
}
