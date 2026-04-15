"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Eye,
  Flame,
  Clock,
  FileText,
  Users,
  DollarSign,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface WatchtowerAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  threadId: string;
  threadSubject: string | null;
  daysSinceLastAction: number;
  suggestedAction: string;
  urgency: "high" | "medium" | "low";
}

interface WatchtowerData {
  alerts: WatchtowerAlert[];
  summary: { total: number; high: number; recoverable: number };
}

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Flame; label: string; color: string }
> = {
  lead_needs_reply: {
    icon: ArrowRight,
    label: "Leads Need Reply",
    color: "text-indigo-500",
  },
  lead_cooling: {
    icon: Flame,
    label: "Leads Cooling Off",
    color: "text-red-400",
  },
  scheduling_stall: {
    icon: Clock,
    label: "Ready to Schedule",
    color: "text-amber-400",
  },
  proposal_forgotten: {
    icon: FileText,
    label: "Proposal Likely Forgotten",
    color: "text-orange-400",
  },
  client_waiting: {
    icon: Users,
    label: "Client Waiting",
    color: "text-blue-400",
  },
  payment_risk: {
    icon: DollarSign,
    label: "Payment Risk",
    color: "text-red-500",
  },
  upsell_window: {
    icon: TrendingUp,
    label: "Automation Complete",
    color: "text-emerald-400",
  },
};

function useWatchtower() {
  return useQuery<WatchtowerData>({
    queryKey: ["watchtower"],
    queryFn: async () => {
      const res = await fetch("/api/watchtower");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

function AlertCard({
  alert,
  onNavigate,
}: {
  alert: WatchtowerAlert;
  onNavigate: (threadId: string) => void;
}) {
  return (
    <Card className="border-stone-200 shadow-none hover:shadow-sm transition-shadow">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-900">
              {alert.title}
            </p>
            <p className="text-xs text-stone-500 truncate">
              {alert.threadSubject ?? "Unknown thread"} — {alert.description}
            </p>
          </div>
          <Badge
            variant={alert.urgency === "high" ? "destructive" : "secondary"}
            className="text-[10px] shrink-0"
          >
            {alert.daysSinceLastAction}d ago
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-indigo-600">
            {alert.suggestedAction}
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2"
              onClick={() => onNavigate(alert.threadId)}
            >
              Review
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WatchtowerPage() {
  const router = useRouter();
  const { data, isLoading } = useWatchtower();

  const alerts = data?.alerts ?? [];
  const summary = data?.summary ?? { total: 0, high: 0, recoverable: 0 };

  // Group alerts by type
  const grouped = alerts.reduce(
    (acc, alert) => {
      if (!acc[alert.type]) acc[alert.type] = [];
      acc[alert.type].push(alert);
      return acc;
    },
    {} as Record<string, WatchtowerAlert[]>
  );

  const typeOrder = [
    "lead_needs_reply",
    "lead_cooling",
    "scheduling_stall",
    "proposal_forgotten",
    "client_waiting",
    "payment_risk",
    "upsell_window",
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-indigo-600" />
        <h1 className="text-lg font-semibold text-stone-900">Watchtower</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <Card className="border-stone-200 shadow-none">
          <CardContent className="py-16 text-center space-y-2">
            <Eye className="h-8 w-8 text-stone-300 mx-auto" />
            <p className="text-sm text-stone-500">
              No situations requiring attention right now.
            </p>
            <p className="text-xs text-stone-400">
              The watchtower monitors all active threads and workflows.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary bar */}
          {summary.recoverable > 0 && (
            <Card className="border-indigo-200 shadow-none bg-indigo-50/50">
              <CardContent className="p-4">
                <p className="text-sm text-indigo-900">
                  <span className="font-semibold">
                    {summary.recoverable} opportunit
                    {summary.recoverable === 1 ? "y" : "ies"}
                  </span>{" "}
                  likely slipping today.{" "}
                  {summary.recoverable > 0 && "I can help recover them."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Grouped sections */}
          {typeOrder.map((type) => {
            const typeAlerts = grouped[type];
            if (!typeAlerts?.length) return null;
            const config = TYPE_CONFIG[type];
            const Icon = config?.icon ?? Eye;

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Icon
                    className={`h-3.5 w-3.5 ${config?.color ?? "text-stone-400"}`}
                  />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                    {config?.label ?? type} ({typeAlerts.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {typeAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onNavigate={(threadId) =>
                        router.push(`/dashboard/threads/${threadId}`)
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
