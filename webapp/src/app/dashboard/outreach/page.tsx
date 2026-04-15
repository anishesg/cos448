"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Megaphone,
  Plus,
  MessageCircle,
  UserPlus,
  Mail,
  MoreHorizontal,
  Play,
  Pause,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Campaign {
  id: string;
  channel: string;
  campaignName: string | null;
  status: string;
  stats: { sent: number; opened: number; replied: number; converted: number } | null;
  createdAt: string;
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  facebook: MessageCircle,
  linkedin: UserPlus,
  email: Mail,
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-blue-50 text-blue-700",
};

function useCampaigns() {
  return useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["outreach-campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/outreach/campaigns");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
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
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const Icon = CHANNEL_ICONS[campaign.channel] ?? Mail;
  const stats = campaign.stats;

  return (
    <Card className="border-stone-200 shadow-none hover:shadow-sm transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-stone-500" />
            <span className="text-sm font-medium text-stone-900">
              {campaign.campaignName ?? "Untitled"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] ${STATUS_STYLES[campaign.status] ?? ""}`}>
              {campaign.status}
            </Badge>
          </div>
        </div>

        {stats && (
          <div className="flex gap-4 text-[11px] text-stone-500">
            <span>
              <strong>{stats.sent}</strong> sent
            </span>
            <span>
              <strong>{stats.replied}</strong> replied
            </span>
            <span>
              <strong>{stats.converted}</strong> converted
            </span>
          </div>
        )}

        <div className="flex gap-1.5">
          {campaign.status === "draft" && (
            <Button variant="default" size="sm" className="h-6 text-[11px] gap-1">
              <Play className="h-3 w-3" />
              Launch
            </Button>
          )}
          {campaign.status === "active" && (
            <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1">
              <Pause className="h-3 w-3" />
              Pause
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OutreachPage() {
  const { data, isLoading } = useCampaigns();
  const createMutation = useCreateCampaign();
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    channel: "email",
    messageTemplate: "",
  });

  const campaigns = data?.campaigns ?? [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-indigo-600" />
          <h1 className="text-lg font-semibold text-stone-900">Outreach</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="text-xs gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="border-stone-200 shadow-none">
          <CardContent className="py-16 text-center space-y-3">
            <Megaphone className="h-10 w-10 text-stone-300 mx-auto" />
            <h2 className="text-base font-semibold text-stone-900">
              No campaigns yet
            </h2>
            <p className="text-sm text-stone-500 max-w-sm mx-auto">
              Create outreach campaigns across Facebook, LinkedIn, and email.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreate(true)}
              className="text-xs gap-1"
            >
              <Plus className="h-3 w-3" />
              Create your first campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}

      {/* Create campaign dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Campaign Name</Label>
              <Input
                value={newCampaign.name}
                onChange={(e) =>
                  setNewCampaign({ ...newCampaign, name: e.target.value })
                }
                placeholder="Q2 consultant outreach"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Channel</Label>
              <Select
                value={newCampaign.channel}
                onValueChange={(v: string | null) => {
                  if (v) setNewCampaign({ ...newCampaign, channel: v });
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message Template</Label>
              <Textarea
                value={newCampaign.messageTemplate}
                onChange={(e) =>
                  setNewCampaign({
                    ...newCampaign,
                    messageTemplate: e.target.value,
                  })
                }
                placeholder="Hi {name}, I noticed..."
                className="text-sm min-h-[80px]"
              />
            </div>
            <Button
              onClick={() => {
                createMutation.mutate({
                  name: newCampaign.name,
                  channel: newCampaign.channel,
                  messageTemplate: newCampaign.messageTemplate,
                  targetCriteria: {},
                });
                setShowCreate(false);
                setNewCampaign({ name: "", channel: "email", messageTemplate: "" });
              }}
              disabled={!newCampaign.name || createMutation.isPending}
              className="w-full h-8 text-xs"
            >
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
