import { cn } from "@/lib/utils";

interface V2SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function V2Skeleton({ className, ...props }: V2SkeletonProps) {
  return (
    <div
      className={cn("rounded-2xl v2-shimmer", className)}
      {...props}
    />
  );
}
