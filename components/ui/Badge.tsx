import { cn } from "@/lib/ui/cn";

type BadgeVariant = "neutral" | "info" | "success" | "warning" | "danger" | "brand";
type BadgeSize = "sm" | "md";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-zinc-100/90 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  info: "bg-sky-100/90 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  success: "bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  warning: "bg-amber-100/90 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  danger: "bg-red-100/90 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  brand: "bg-violet-100/80 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-1.5 py-px text-[9px] font-medium",
  md: "px-2 py-0.5 text-[10px] font-medium",
};

export function Badge({
  variant = "neutral",
  size = "md",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center rounded-full break-words",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
