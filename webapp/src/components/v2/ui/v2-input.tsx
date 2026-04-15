import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type InputColor = "green" | "purple" | "cyan" | "default";

interface V2InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  focusColor?: InputColor;
}

const focusRingMap: Record<InputColor, string> = {
  green: "focus:border-[rgba(0,232,123,0.25)] focus:shadow-[0_0_0_3px_rgba(0,232,123,0.06),0_0_16px_rgba(0,232,123,0.04)]",
  purple: "focus:border-[rgba(168,85,247,0.25)] focus:shadow-[0_0_0_3px_rgba(168,85,247,0.06)]",
  cyan: "focus:border-[rgba(0,212,255,0.25)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.06)]",
  default: "focus:border-[rgba(255,255,255,0.12)] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.02)]",
};

export const V2Input = forwardRef<HTMLInputElement, V2InputProps>(
  ({ className, focusColor = "default", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-4 py-[10px] text-[13px] text-[var(--v2-text-primary)] placeholder-[var(--v2-text-ghost)] outline-none transition-all duration-200",
          "shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]",
          focusRingMap[focusColor],
          className
        )}
        {...props}
      />
    );
  }
);
V2Input.displayName = "V2Input";
