"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "./use-count-up";

type AccentColor = "green" | "purple" | "cyan" | "amber" | "red";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  accent: AccentColor;
  detail?: string;
  trend?: { value: number; positive: boolean };
  miniBar?: number[];
}

const iconGradient: Record<AccentColor, string> = {
  green: "from-[#00e87b] to-[#00d4ff]",
  purple: "from-[#a855f7] to-[#ff2d87]",
  cyan: "from-[#00d4ff] to-[#00e87b]",
  amber: "from-[#ffb800] to-[#ff4060]",
  red: "from-[#ff4060] to-[#ffb800]",
};

const accentColor: Record<AccentColor, string> = {
  green: "#00e87b",
  purple: "#a855f7",
  cyan: "#00d4ff",
  amber: "#ffb800",
  red: "#ff4060",
};

const barGradient: Record<AccentColor, string> = {
  green: "bg-gradient-to-t from-[#00e87b] to-[#00d4ff]",
  purple: "bg-gradient-to-t from-[#a855f7] to-[#ff2d87]",
  cyan: "bg-gradient-to-t from-[#00d4ff] to-[#00e87b]",
  amber: "bg-gradient-to-t from-[#ffb800] to-[#ff4060]",
  red: "bg-gradient-to-t from-[#ff4060] to-[#ffb800]",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  detail,
  trend,
  miniBar,
}: StatCardProps) {
  const maxBar = miniBar ? Math.max(...miniBar, 1) : 0;
  const animatedValue = useCountUp(value);
  const neon = accentColor[accent];

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] backdrop-blur-xl transition-all duration-300 hover:border-[rgba(255,255,255,0.1)] hover:-translate-y-0.5"
      style={{
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px -4px rgba(0,0,0,0.2)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 40px -8px rgba(0,0,0,0.3), 0 0 40px ${neon}08`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          `inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px -4px rgba(0,0,0,0.2)`;
      }}
    >
      {/* Ambient corner glow */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: neon }}
      />

      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
              iconGradient[accent]
            )}
          >
            <Icon className="h-[18px] w-[18px] text-[#08080f]" strokeWidth={2.2} />
          </div>
          {trend && (
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                trend.positive ? "text-[#00e87b]" : "text-[#ff4060]"
              )}
            >
              {trend.positive ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>

        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--v2-text-ghost)]">
          {label}
        </p>
        <p className="mt-1.5 text-[32px] font-bold leading-none tracking-tight text-white tabular-nums">
          {animatedValue.toLocaleString()}
        </p>

        {miniBar && miniBar.length > 0 && (
          <div className="mt-5 flex items-end gap-[3px]">
            {miniBar.map((v, i) => (
              <div
                key={i}
                className={cn("w-full rounded-full transition-all duration-500", barGradient[accent])}
                style={{
                  height: `${Math.max((v / maxBar) * 22, 3)}px`,
                  opacity: 0.25 + (i / miniBar.length) * 0.75,
                }}
              />
            ))}
          </div>
        )}

        {detail && (
          <p className="mt-3.5 text-[11px] font-medium text-[var(--v2-text-tertiary)]">{detail}</p>
        )}
      </div>
    </div>
  );
}
