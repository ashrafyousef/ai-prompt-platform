import { cn } from "@/lib/ui/cn";
import { Card } from "@/components/ui/Card";

type PanelPadding = "none" | "sm" | "md" | "lg";

export type PanelProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  padding?: PanelPadding;
  children: React.ReactNode;
  className?: string;
  id?: string;
};

const bodyPaddingClasses: Record<PanelPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Panel({
  title,
  description,
  actions,
  padding = "md",
  children,
  className,
  id,
}: PanelProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <Card padding="none" id={id} className={className}>
      {hasHeader ? (
        <div className="flex flex-col gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyPaddingClasses[padding]}>{children}</div>
    </Card>
  );
}
