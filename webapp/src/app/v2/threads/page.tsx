"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { MessageSquare, Search } from "lucide-react";
import { V2Input } from "@/components/v2/ui/v2-input";
import { V2Skeleton } from "@/components/v2/ui/v2-skeleton";
import { V2Badge } from "@/components/v2/ui/v2-badge";
import { ThreadCardV2, type EmailThreadData } from "@/components/v2/thread-card-v2";
import { PageTransition } from "@/components/v2/motion-wrapper";

export default function V2ThreadsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ threads: EmailThreadData[] }>({
    queryKey: ["emails"],
    queryFn: async () => {
      const res = await fetch("/api/emails?limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const threads = data?.threads ?? [];
  const filtered = search
    ? threads.filter(
        (t) =>
          t.subject?.toLowerCase().includes(search.toLowerCase()) ||
          t.snippet?.toLowerCase().includes(search.toLowerCase())
      )
    : threads;

  return (
    <PageTransition>
      <div className="mx-auto max-w-[760px] px-8 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00e87b] to-[#00d4ff] shadow-[0_0_20px_rgba(0,232,123,0.15)]">
              <MessageSquare className="h-[18px] w-[18px] text-[#08080f]" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="v2-text-gradient text-[24px] font-bold tracking-[-0.02em]">All Threads</h1>
            </div>
            {threads.length > 0 && <V2Badge color="muted">{threads.length}</V2Badge>}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--v2-text-ghost)]" />
          <V2Input
            placeholder="Search threads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
            focusColor="green"
          />
        </div>

        {/* Thread list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <V2Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl py-24 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="pointer-events-none absolute left-1/2 top-0 h-24 w-48 -translate-x-1/2 rounded-full bg-gradient-to-b from-[rgba(0,232,123,0.04)] to-transparent blur-2xl" />
            <MessageSquare className="mx-auto h-8 w-8 text-[var(--v2-text-ghost)]" strokeWidth={1.5} />
            <p className="mt-4 text-[14px] font-medium text-[var(--v2-text-tertiary)]">
              {search ? "No threads match your search" : "No threads yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((thread) => (
              <ThreadCardV2
                key={thread.id}
                thread={thread}
                onSelect={(id) => router.push(`/v2/threads/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
