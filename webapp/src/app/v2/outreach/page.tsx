"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Megaphone,
  Plus,
  MessageCircle,
  UserPlus,
  Mail,
  Play,
  Pause,
} from "lucide-react";
import { PageTransition } from "@/components/v2/motion-wrapper";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { V2Button } from "@/components/v2/ui/v2-button";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";
import { V2Dialog } from "@/components/v2/ui/v2-dialog";
import { V2Input } from "@/components/v2/ui/v2-input";
import { cn } from "@/lib/utils";

interface Campaign {
  id: string;
  channel: string;
  campaignName: string | null;
  status: string;
  stats: {
    sent: number;
    opened: number;
    replied: number;
    converted: number;
  } | null;
  createdAt: string;
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  facebook: MessageCircle,
  linkedin: UserPlus,
  email: Mail,
};

const CHANNEL_ICON_STYLE: Record<
  string,
  { gradient: string; shadow: string; iconClass: string }
> = {
  email: {
    gradient: "from-[#00d4ff] to-[#a855f7]",
    shadow: "shadow-[0_0_22px_rgba(0,212,255,0.35)]",
    iconClass: "text-[var(--v2-bg-base)]",
  },
  linkedin: {
    gradient: "from-[#a855f7] to-[#ff2d87]",
    shadow: "shadow-[0_0_22px_rgba(168,85,247,0.4)]",
    iconClass: "text-white",
  },
  facebook: {
    gradient: "from-[#00e87b] to-[#00d4ff]",
    shadow: "shadow-[0_0_22px_rgba(0,232,123,0.4)]",
    iconClass: "text-[var(--v2-bg-base)]",
  },
};

const STATUS_BADGE: Record<string, "green" | "amber" | "muted" | "cyan"> = {
  active: "green",
  draft: "amber",
  paused: "muted",
  completed: "cyan",
};

const glassCard =
  "rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

const selectClassName =
  "w-full rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-3.5 py-[10px] text-[13px] text-[var(--v2-text-secondary)] outline-none";

const textareaClassName =
  "min-h-[80px] w-full resize-y rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-4 py-[10px] text-[13px] text-[var(--v2-text-primary)] placeholder-[var(--v2-text-ghost)] outline-none backdrop-blur-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-all duration-200 focus:border-[rgba(0,232,123,0.25)] focus:shadow-[0_0_0_3px_rgba(0,232,123,0.06),0_0_16px_rgba(0,232,123,0.04)]";

function CampaignCardV2({ campaign }: { campaign: Campaign }) {
  const Icon = CHANNEL_ICONS[campaign.channel] ?? Mail;
  const stats = campaign.stats;
  const iconStyle =
    CHANNEL_ICON_STYLE[campaign.channel] ?? CHANNEL_ICON_STYLE.email;

  return (
    <div className={cn(glassCard, "p-4 space-y-3")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
              iconStyle.gradient,
              iconStyle.shadow
            )}
          >
            <Icon className={cn("h-4 w-4", iconStyle.iconClass)} />
          </div>
          <span className="truncate text-[14px] font-medium text-[var(--v2-text-primary)]">
            {campaign.campaignName ?? "Untitled"}
          </span>
        </div>
        <V2Badge color={STATUS_BADGE[campaign.status] ?? "muted"} dot>
          {campaign.status}
        </V2Badge>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
          <span className="text-[var(--v2-text-tertiary)]">
            <span className="font-semibold tabular-nums text-[var(--v2-text-secondary)]">
              {stats.sent}
            </span>{" "}
            sent
          </span>
          <span className="text-[var(--v2-text-tertiary)]">
            <span className="font-semibold tabular-nums text-[var(--v2-text-secondary)]">
              {stats.opened}
            </span>{" "}
            opened
          </span>
          <span className="text-[var(--v2-text-tertiary)]">
            <span className="font-semibold tabular-nums text-[var(--v2-text-secondary)]">
              {stats.replied}
            </span>{" "}
            replied
          </span>
          <span className="text-[var(--v2-text-tertiary)]">
            <span className="font-semibold tabular-nums text-[#00e87b]">
              {stats.converted}
            </span>{" "}
            converted
          </span>
        </div>
      )}

      <div className="flex gap-2">
        {campaign.status === "draft" && (
          <V2Button size="sm" color="green">
            <Play className="h-3 w-3" />
            Launch
          </V2Button>
        )}
        {campaign.status === "active" && (
          <V2Button variant="outline" size="sm" color="amber">
            <Pause className="h-3 w-3" />
            Pause
          </V2Button>
        )}
      </div>
    </div>
  );
}

export default function V2OutreachPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["outreach-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/outreach/campaigns");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      channel: string;
      messageTemplate: string;
      targetCriteria: Record<string, unknown>;
    }) => {
      const res = await fetch("/api/outreach/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach-campaigns"] }),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    channel: "email",
    messageTemplate: "",
  });

  const campaigns = data?.campaigns ?? [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00e87b] to-[#00d4ff] shadow-[0_0_24px_rgba(0,232,123,0.45)]">
              <Megaphone className="h-5 w-5 text-[var(--v2-bg-base)]" />
            </div>
            <h1 className="v2-text-gradient text-[24px] font-bold tracking-[-0.02em]">
              Outreach
            </h1>
          </div>
          <V2Button
            variant="outline"
            size="sm"
            color="green"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Campaign
          </V2Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <V2Skeleton
                key={i}
                className="h-36 w-full rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
              />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div
            className={cn(
              glassCard,
              "relative flex flex-col items-center justify-center overflow-hidden py-24 text-center"
            )}
          >
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[rgba(0,232,123,0.14)] blur-3xl" />
            <div className="pointer-events-none absolute -right-20 top-1/3 h-56 w-56 rounded-full bg-[rgba(168,85,247,0.12)] blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[rgba(0,212,255,0.1)] blur-3xl" />

            <div className="relative z-[1] flex flex-col items-center px-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00e87b] to-[#00d4ff] shadow-[0_0_36px_rgba(0,232,123,0.45)]">
                <Megaphone className="h-7 w-7 text-[var(--v2-bg-base)]" />
              </div>
              <h2 className="v2-text-gradient mt-5 text-[17px] font-semibold tracking-[-0.02em]">
                No campaigns yet
              </h2>
              <p className="mt-2 max-w-sm text-[13px] text-[var(--v2-text-tertiary)]">
                Create outreach campaigns across email, LinkedIn, and Facebook.
              </p>
              <V2Button
                variant="outline"
                color="green"
                size="sm"
                className="mt-6"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-3 w-3" />
                Create your first campaign
              </V2Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {campaigns.map((c) => (
              <CampaignCardV2 key={c.id} campaign={c} />
            ))}
          </div>
        )}

        <V2Dialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="New Campaign"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--v2-text-tertiary)]">
                Campaign Name
              </label>
              <V2Input
                value={newCampaign.name}
                onChange={(e) =>
                  setNewCampaign({ ...newCampaign, name: e.target.value })
                }
                placeholder="Q2 consultant outreach"
                focusColor="green"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--v2-text-tertiary)]">
                Channel
              </label>
              <select
                value={newCampaign.channel}
                onChange={(e) =>
                  setNewCampaign({ ...newCampaign, channel: e.target.value })
                }
                className={selectClassName}
              >
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--v2-text-tertiary)]">
                Message Template
              </label>
              <textarea
                value={newCampaign.messageTemplate}
                onChange={(e) =>
                  setNewCampaign({
                    ...newCampaign,
                    messageTemplate: e.target.value,
                  })
                }
                placeholder="Hi {name}, I noticed..."
                className={textareaClassName}
              />
            </div>
            <V2Button
              color="green"
              className="w-full"
              onClick={() => {
                createMutation.mutate({
                  name: newCampaign.name,
                  channel: newCampaign.channel,
                  messageTemplate: newCampaign.messageTemplate,
                  targetCriteria: {},
                });
                setShowCreate(false);
                setNewCampaign({
                  name: "",
                  channel: "email",
                  messageTemplate: "",
                });
              }}
              disabled={!newCampaign.name || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </V2Button>
          </div>
        </V2Dialog>
      </div>
    </PageTransition>
  );
}
