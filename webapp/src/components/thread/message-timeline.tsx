"use client";

import { useMemo } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Bot, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Message {
  id: string;
  direction: string;
  senderEmail: string | null;
  senderName: string | null;
  bodySummary: string | null;
  bodyFull: string | null;
  sentAt: string | null;
  isAgentGenerated: boolean | null;
}

interface MessageTimelineProps {
  messages: Message[];
  userEmail: string;
}

const QUOTED_REPLY_PATTERNS = [
  /^On .+ wrote:$/m,
  /^-{2,}\s*Original Message\s*-{2,}$/m,
  /^From:\s.+$/m,
];

function splitQuotedReply(text: string): { main: string; quoted: string | null } {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of QUOTED_REPLY_PATTERNS) {
      if (pattern.test(lines[i])) {
        const main = lines.slice(0, i).join("\n").trim();
        const quoted = lines.slice(i).join("\n").trim();
        if (main.length > 10) return { main, quoted };
      }
    }
  }
  return { main: text, quoted: null };
}

function MessageBubble({ msg }: { msg: Message }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const body = msg.bodyFull ?? msg.bodySummary ?? "(no content)";
  const { main, quoted } = useMemo(() => splitQuotedReply(body), [body]);

  return (
    <div className="space-y-1">
      <div className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-wrap break-words">
        {main}
      </div>
      {quoted && (
        <>
          <button
            onClick={() => setShowQuoted(!showQuoted)}
            className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition-colors mt-1"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                !showQuoted && "-rotate-90"
              )}
            />
            {showQuoted ? "Hide" : "Show"} quoted text
          </button>
          {showQuoted && (
            <div className="text-[11px] text-stone-400 leading-relaxed whitespace-pre-wrap break-words border-l-2 border-stone-200 pl-3 mt-1">
              {quoted}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function MessageTimeline({ messages }: MessageTimelineProps) {
  return (
    <div className="space-y-4">
      {messages.map((msg, idx) => {
        const isOutbound = msg.direction === "outbound";
        const isAgent = msg.isAgentGenerated;

        return (
          <div key={msg.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold",
                  isAgent
                    ? "bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 ring-2 ring-indigo-200"
                    : isOutbound
                      ? "bg-stone-200 text-stone-600"
                      : "bg-stone-100 text-stone-500"
                )}
              >
                {isAgent ? (
                  <Bot className="h-3.5 w-3.5" />
                ) : (
                  <User className="h-3.5 w-3.5" />
                )}
              </div>
              {idx < messages.length - 1 && (
                <div className="w-px flex-1 bg-stone-200 mt-1" />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1 pb-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-stone-700">
                  {isOutbound
                    ? msg.senderName ?? "You"
                    : msg.senderName ?? msg.senderEmail ?? "Unknown"}
                </span>
                {isAgent && (
                  <span className="text-[9px] font-medium text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                    AI-sent
                  </span>
                )}
                {msg.sentAt && (
                  <span className="text-[10px] text-stone-400">
                    {format(new Date(msg.sentAt), "MMM d, h:mm a")}
                    {" · "}
                    {formatDistanceToNow(new Date(msg.sentAt), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>

              <div
                className={cn(
                  "rounded-lg p-3",
                  isAgent
                    ? "bg-indigo-50/60 border border-indigo-100"
                    : isOutbound
                      ? "bg-stone-50 border border-stone-200"
                      : "bg-white border border-stone-100"
                )}
              >
                <MessageBubble msg={msg} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
