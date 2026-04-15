import { cn } from "@/lib/utils";

type BadgeColor = "green" | "purple" | "cyan" | "amber" | "red" | "magenta" | "muted";

interface V2BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  dot?: boolean;
  glow?: boolean;
}

const colorMap: Record<BadgeColor, string> = {
  green: "border-[rgba(0,232,123,0.12)] bg-[rgba(0,232,123,0.06)] text-[#00e87b]",
  purple: "border-[rgba(168,85,247,0.12)] bg-[rgba(168,85,247,0.06)] text-[#a855f7]",
  cyan: "border-[rgba(0,212,255,0.12)] bg-[rgba(0,212,255,0.06)] text-[#00d4ff]",
  amber: "border-[rgba(255,184,0,0.12)] bg-[rgba(255,184,0,0.06)] text-[#ffb800]",
  red: "border-[rgba(255,64,96,0.12)] bg-[rgba(255,64,96,0.06)] text-[#ff4060]",
  magenta: "border-[rgba(255,45,135,0.12)] bg-[rgba(255,45,135,0.06)] text-[#ff2d87]",
  muted: "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] text-[var(--v2-text-tertiary)]",
};

const dotColorMap: Record<BadgeColor, string> = {
  green: "bg-[#00e87b] shadow-[0_0_6px_rgba(0,232,123,0.5)]",
  purple: "bg-[#a855f7] shadow-[0_0_6px_rgba(168,85,247,0.5)]",
  cyan: "bg-[#00d4ff] shadow-[0_0_6px_rgba(0,212,255,0.5)]",
  amber: "bg-[#ffb800] shadow-[0_0_6px_rgba(255,184,0,0.5)]",
  red: "bg-[#ff4060] shadow-[0_0_6px_rgba(255,64,96,0.5)]",
  magenta: "bg-[#ff2d87] shadow-[0_0_6px_rgba(255,45,135,0.5)]",
  muted: "bg-[var(--v2-text-ghost)]",
};

export function V2Badge({
  className,
  color = "muted",
  dot = false,
  glow = false,
  children,
  ...props
}: V2BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em]",
        colorMap[color],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("h-[5px] w-[5px] rounded-full", dotColorMap[color])} />
      )}
      {children}
    </span>
  );
}
