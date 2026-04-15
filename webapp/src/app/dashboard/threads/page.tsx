"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { MessageSquare, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ThreadCard, type EmailThreadData } from "@/components/feed/thread-card";
import { useState } from "react";

function useAllThreads() {
  return useQuery<{ threads: EmailThreadData[] }>({
    queryKey: ["emails"],
    queryFn: async () => {
      const res = await fetch("/api/emails?limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
}

export default function ThreadsListPage() {
  const router = useRouter();
  const { data, isLoading } = useAllThreads();
  const [search, setSearch] = useState("");

  const threads = data?.threads ?? [];
  const filtered = search
    ? threads.filter(
        (t) =>
          t.subject?.toLowerCase().includes(search.toLowerCase()) ||
          t.snippet?.toLowerCase().includes(search.toLowerCase())
      )
    : threads;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-900">All Threads</h1>
        <span className="text-xs text-stone-400">
          {threads.length} threads
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <Input
          placeholder="Search threads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center space-y-2">
          <MessageSquare className="h-8 w-8 text-stone-300" />
          <p className="text-sm text-stone-500">
            {search ? "No threads match your search" : "No threads yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onSelect={(id) => router.push(`/dashboard/threads/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
