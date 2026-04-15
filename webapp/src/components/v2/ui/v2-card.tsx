import { cn } from "@/lib/utils";

interface V2CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: "green" | "purple" | "red" | "amber" | "cyan";
  hover?: boolean;
}

const glowMap = {
  green: "hover:shadow-[0_0_40px_rgba(0,232,123,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]",
  purple: "hover:shadow-[0_0_40px_rgba(168,85,247,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]",
  red: "hover:shadow-[0_0_40px_rgba(255,64,96,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]",
  amber: "hover:shadow-[0_0_40px_rgba(255,184,0,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]",
  cyan: "hover:shadow-[0_0_40px_rgba(0,212,255,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]",
};

export function V2Card({
  className,
  glow,
  hover = true,
  children,
  ...props
}: V2CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] backdrop-blur-xl transition-all duration-300",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.2)]",
        hover && [
          "hover:border-[rgba(255,255,255,0.1)]",
          "hover:bg-[rgba(255,255,255,0.04)]",
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_40px_-8px_rgba(0,0,0,0.3)]",
        ],
        glow && glowMap[glow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function V2CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  );
}
