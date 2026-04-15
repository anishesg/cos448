import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type ButtonVariant = "solid" | "outline" | "ghost";
type ButtonColor = "green" | "purple" | "cyan" | "amber" | "red" | "muted";
type ButtonSize = "sm" | "md" | "lg";

interface V2ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  color?: ButtonColor;
  size?: ButtonSize;
}

const sizeMap: Record<ButtonSize, string> = {
  sm: "rounded-[10px] px-3.5 py-[7px] text-[11px] gap-1.5",
  md: "rounded-[10px] px-4.5 py-[9px] text-[12px] gap-2",
  lg: "rounded-[12px] px-6 py-[11px] text-[13px] gap-2",
};

const solidMap: Record<ButtonColor, string> = {
  green:
    "bg-gradient-to-r from-[#00e87b] via-[#00d88e] to-[#00d4ff] text-[#08080f] font-semibold shadow-[0_2px_16px_rgba(0,232,123,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_24px_rgba(0,232,123,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:brightness-110",
  purple:
    "bg-gradient-to-r from-[#a855f7] via-[#c060ff] to-[#ff2d87] text-white font-semibold shadow-[0_2px_16px_rgba(168,85,247,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_4px_24px_rgba(168,85,247,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] hover:brightness-110",
  cyan:
    "bg-gradient-to-r from-[#00d4ff] to-[#0ea5e9] text-[#08080f] font-semibold shadow-[0_2px_16px_rgba(0,212,255,0.25)] hover:shadow-[0_4px_24px_rgba(0,212,255,0.35)] hover:brightness-110",
  amber:
    "bg-gradient-to-r from-[#ffb800] to-[#ff8c00] text-[#08080f] font-semibold shadow-[0_2px_16px_rgba(255,184,0,0.25)] hover:shadow-[0_4px_24px_rgba(255,184,0,0.35)] hover:brightness-110",
  red:
    "bg-gradient-to-r from-[#ff4060] to-[#ef4444] text-white font-semibold shadow-[0_2px_16px_rgba(255,64,96,0.25)] hover:shadow-[0_4px_24px_rgba(255,64,96,0.35)] hover:brightness-110",
  muted:
    "bg-[rgba(255,255,255,0.04)] text-[var(--v2-text-secondary)] font-medium border border-[rgba(255,255,255,0.07)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--v2-text-primary)]",
};

const outlineMap: Record<ButtonColor, string> = {
  green: "border border-[rgba(0,232,123,0.2)] text-[#00e87b] hover:bg-[rgba(0,232,123,0.06)] hover:border-[rgba(0,232,123,0.3)] hover:shadow-[0_0_16px_rgba(0,232,123,0.06)]",
  purple: "border border-[rgba(168,85,247,0.2)] text-[#a855f7] hover:bg-[rgba(168,85,247,0.06)] hover:border-[rgba(168,85,247,0.3)] hover:shadow-[0_0_16px_rgba(168,85,247,0.06)]",
  cyan: "border border-[rgba(0,212,255,0.2)] text-[#00d4ff] hover:bg-[rgba(0,212,255,0.06)] hover:border-[rgba(0,212,255,0.3)]",
  amber: "border border-[rgba(255,184,0,0.2)] text-[#ffb800] hover:bg-[rgba(255,184,0,0.06)] hover:border-[rgba(255,184,0,0.3)]",
  red: "border border-[rgba(255,64,96,0.2)] text-[#ff4060] hover:bg-[rgba(255,64,96,0.06)] hover:border-[rgba(255,64,96,0.3)]",
  muted: "border border-[rgba(255,255,255,0.07)] text-[var(--v2-text-tertiary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--v2-text-secondary)] hover:border-[rgba(255,255,255,0.12)]",
};

const ghostMap: Record<ButtonColor, string> = {
  green: "text-[#00e87b] hover:bg-[rgba(0,232,123,0.06)]",
  purple: "text-[#a855f7] hover:bg-[rgba(168,85,247,0.06)]",
  cyan: "text-[#00d4ff] hover:bg-[rgba(0,212,255,0.06)]",
  amber: "text-[#ffb800] hover:bg-[rgba(255,184,0,0.06)]",
  red: "text-[#ff4060] hover:bg-[rgba(255,64,96,0.06)]",
  muted: "text-[var(--v2-text-tertiary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--v2-text-secondary)]",
};

const variantMap = { solid: solidMap, outline: outlineMap, ghost: ghostMap };

export const V2Button = forwardRef<HTMLButtonElement, V2ButtonProps>(
  ({ className, variant = "solid", color = "green", size = "md", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer whitespace-nowrap active:scale-[0.97]",
          sizeMap[size],
          variantMap[variant][color],
          disabled && "opacity-40 pointer-events-none",
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);
V2Button.displayName = "V2Button";
