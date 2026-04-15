"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, CheckCircle2, XCircle, Clock, Play, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface BrowserTask {
  id: string;
  objective: string;
  tier: number;
  targetUrl: string | null;
  status: string;
  result: Record<string, unknown> | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-amber-500", label: "Awaiting Approval" },
  approved: { icon: Play, color: "text-blue-500", label: "Queued" },
  executing: { icon: Play, color: "text-indigo-500", label: "Running" },
  succeeded: { icon: CheckCircle2, color: "text-emerald-500", label: "Succeeded" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  cancelled: { icon: XCircle, color: "text-stone-400", label: "Cancelled" },
};

const TIER_LABELS: Record<number, string> = {
  1: "Deterministic",
  2: "AI-Guided",
  3: "Full Agent",
};

function useBrowserTasks() {
  return useQuery<{ tasks: BrowserTask[] }>({
    queryKey: ["browser-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/browser");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 10_000,
  });
}

function useApproveBrowserTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch("/api/browser", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, action: "approve" }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["browser-tasks"] }),
  });
}

function TaskCard({ task }: { task: BrowserTask }) {
  const approveMutation = useApproveBrowserTask();
  const config = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <Card className="border-stone-200 shadow-none">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${config.color}`} />
              <span className="text-sm font-medium text-stone-900">
                {task.objective}
              </span>
            </div>
            {task.targetUrl && (
              <p className="text-[11px] text-stone-400 truncate">
                {task.targetUrl}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px]">
              Tier {task.tier}: {TIER_LABELS[task.tier]}
            </Badge>
            <Badge
              variant="secondary"
              className={`text-[10px] ${config.color}`}
            >
              {config.label}
            </Badge>
          </div>
        </div>

        {/* Operator view when executing */}
        {task.status === "executing" && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
            <div className="flex items-center gap-2 text-xs text-indigo-700">
              <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              Agent is navigating...
            </div>
          </div>
        )}

        {/* Result */}
        {task.result && task.status === "succeeded" && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
            <p className="text-xs text-emerald-700">
              Task completed successfully.
            </p>
          </div>
        )}
        {task.result && task.status === "failed" && (
          <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
            <p className="text-xs text-red-700">
              {(task.result as { error?: string }).error ?? "Task failed"}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-stone-400">
            {formatDistanceToNow(new Date(task.createdAt), {
              addSuffix: true,
            })}
          </span>
          {task.status === "pending" && (
            <div className="flex gap-1.5">
              <Button
                variant="default"
                size="sm"
                className="h-6 text-[11px] px-3"
                onClick={() => approveMutation.mutate(task.id)}
                disabled={approveMutation.isPending}
              >
                <Shield className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2"
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OperatorPage() {
  const { data, isLoading } = useBrowserTasks();
  const tasks = data?.tasks ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-stone-900">
          Browser Operator
        </h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className="border-stone-200 shadow-none">
          <CardContent className="py-16 text-center space-y-2">
            <Globe className="h-8 w-8 text-stone-300 mx-auto" />
            <p className="text-sm text-stone-500">
              No browser tasks yet.
            </p>
            <p className="text-xs text-stone-400">
              The agent will create browser tasks when external actions are needed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
