"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface V2DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function V2Dialog({ open, onClose, title, children, className }: V2DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-[rgba(0,0,0,0.75)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[var(--v2-bg-surface)] v2-animate-in",
          "shadow-[0_32px_80px_-16px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] px-6 py-5">
            <h2 className="text-[15px] font-semibold text-[var(--v2-text-primary)]">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--v2-text-ghost)] transition-all hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--v2-text-tertiary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
