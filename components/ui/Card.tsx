import { cn } from "@/lib/ui/cn";
import { uiTokens } from "@/lib/ui/tokens";

type CardVariant = "default" | "muted" | "interactive";
type CardPadding = "none" | "sm" | "md" | "lg";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: CardPadding;
};

const variantClasses: Record<CardVariant, string> = {
  default: cn(uiTokens.surface.card, uiTokens.border.default, uiTokens.shadow.card),
  muted: cn(uiTokens.surface.muted, uiTokens.border.default, uiTokens.shadow.card),
  interactive: cn(
    uiTokens.surface.card,
    uiTokens.border.default,
    uiTokens.shadow.card,
    "transition-colors hover:border-zinc-300 hover:bg-zinc-50/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
  ),
};

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn("rounded-2xl border", variantClasses[variant], paddingClasses[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
}
