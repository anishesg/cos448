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
import { cn } from "@/lib/utils";
import { V2Card, V2CardContent } from "@/components/v2/ui/v2-card";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { V2Button } from "@/components/v2/ui/v2-button";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";
import { PageTransition } from "@/components/v2/motion-wrapper";

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
  {
    icon: typeof Flame;
    label: string;
    color: string;
    badgeColor: "red" | "amber" | "cyan" | "green" | "purple" | "muted";
  }
> = {
  lead_cooling: {
    icon: Flame,
    label: "Leads Cooling Off",
    color: "text-[#ff4060]",
    badgeColor: "red",
  },
  scheduling_stall: {
    icon: Clock,
    label: "Scheduling Stalls",
    color: "text-[#ffb800]",
    badgeColor: "amber",
  },
  proposal_forgotten: {
    icon: FileText,
    label: "Proposal Forgotten",
    color: "text-[#ffb800]",
    badgeColor: "amber",
  },
  client_waiting: {
    icon: Users,
    label: "Client Waiting",
    color: "text-[#00d4ff]",
    badgeColor: "cyan",
  },
  payment_risk: {
    icon: DollarSign,
    label: "Payment Risk",
    color: "text-[#ff4060]",
    badgeColor: "red",
  },
  upsell_window: {
    icon: TrendingUp,
    label: "Upsell Window",
    color: "text-[#00e87b]",
    badgeColor: "green",
  },
};

function AlertCardV2({
  alert,
  onNavigate,
}: {
  alert: WatchtowerAlert;
  onNavigate: (threadId: string) => void;
}) {
  return (
    <V2Card>
      <V2CardContent className="space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-[14px] font-medium text-[var(--v2-text-primary)]">
              {alert.title}
            </p>
            <p className="truncate text-[12px] text-[var(--v2-text-secondary)]">
              {alert.threadSubject ?? "Unknown thread"} — {alert.description}
            </p>
          </div>
          <V2Badge
            color={alert.urgency === "high" ? "red" : "amber"}
            dot
          >
            {alert.daysSinceLastAction}d ago
          </V2Badge>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-[#00d4ff]">{alert.suggestedAction}</p>
          <V2Button
            variant="ghost"
            size="sm"
            color="muted"
            onClick={() => onNavigate(alert.threadId)}
          >
            Review
            <ArrowRight className="h-3 w-3" />
          </V2Button>
        </div>
      </V2CardContent>
    </V2Card>
  );
}

export default function V2WatchtowerPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery<WatchtowerData>({
    queryKey: ["watchtower"],
    queryFn: async () => {
      const res = await fetch("/api/watchtower");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const alerts = data?.alerts ?? [];
  const summary = data?.summary ?? { total: 0, high: 0, recoverable: 0 };

  const grouped = alerts.reduce(
    (acc, alert) => {
      if (!acc[alert.type]) acc[alert.type] = [];
      acc[alert.type].push(alert);
      return acc;
    },
    {} as Record<string, WatchtowerAlert[]>
  );

  const typeOrder = [
    "lead_cooling",
    "scheduling_stall",
    "proposal_forgotten",
    "client_waiting",
    "payment_risk",
    "upsell_window",
  ];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#ffb800] to-[#ff4060] shadow-[0_0_20px_rgba(255,184,0,0.18)]">
            <Eye className="h-[18px] w-[18px] text-[#08080f]" strokeWidth={2.2} />
          </div>
          <h1 className="v2-text-gradient text-[24px] font-bold tracking-[-0.02em]">
            Watchtower
          </h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <V2Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] py-24 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
            <div className="pointer-events-none absolute left-1/2 top-0 h-32 w-56 -translate-x-1/2 rounded-full bg-gradient-to-b from-[rgba(255,184,0,0.14)] via-[rgba(168,85,247,0.06)] to-transparent blur-3xl" />
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffb800] to-[#ff4060] shadow-[0_0_24px_rgba(255,184,0,0.22)]">
              <Eye className="h-7 w-7 text-[#08080f]" strokeWidth={2} />
            </div>
            <h2 className="v2-text-gradient relative mt-5 text-[18px] font-bold tracking-[-0.02em]">
              All clear
            </h2>
            <p className="relative mt-2 max-w-md px-6 text-[14px] text-[var(--v2-text-secondary)]">
              No situations requiring attention right now.
            </p>
            <p className="relative mt-1 max-w-md px-6 text-[12px] text-[var(--v2-text-tertiary)]">
              The watchtower monitors all active threads and workflows.
            </p>
          </div>
        ) : (
          <>
            {summary.recoverable > 0 && (
              <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-[rgba(255,184,0,0.35)] to-transparent blur-3xl" />
                <div className="pointer-events-none absolute -left-4 top-0 h-24 w-32 rounded-full bg-gradient-to-tr from-[rgba(255,64,96,0.12)] to-transparent blur-2xl" />
                <p className="relative text-[14px] text-[var(--v2-text-primary)]">
                  <span className="font-semibold text-[#ffb800]">
                    {summary.recoverable} opportunit
                    {summary.recoverable === 1 ? "y" : "ies"}
                  </span>{" "}
                  <span className="text-[var(--v2-text-secondary)]">
                    likely slipping today.{" "}
                    {summary.recoverable > 0 && "I can help recover them."}
                  </span>
                </p>
              </div>
            )}

            {typeOrder.map((type) => {
              const typeAlerts = grouped[type];
              if (!typeAlerts?.length) return null;
              const config = TYPE_CONFIG[type];
              const Icon = config?.icon ?? Eye;

              return (
                <div key={type} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] pb-2">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-[10px] bg-[rgba(255,255,255,0.04)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5",
                          config?.color ?? "text-[var(--v2-text-tertiary)]",
                        )}
                      />
                    </div>
                    <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--v2-text-secondary)]">
                      {config?.label ?? type}
                    </h2>
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--v2-text-tertiary)]">
                      {typeAlerts.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {typeAlerts.map((alert) => (
                      <AlertCardV2
                        key={alert.id}
                        alert={alert}
                        onNavigate={(threadId) =>
                          router.push(`/v2/threads/${threadId}`)
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
    </PageTransition>
  );
}
