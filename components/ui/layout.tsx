import { cn } from "@/lib/ui/cn";

export type PageShellProps = React.HTMLAttributes<HTMLDivElement>;

export function PageShell({ className, children, ...props }: PageShellProps) {
  return (
    <div className={cn("space-y-6", className)} {...props}>
      {children}
    </div>
  );
}

export type SectionStackProps = React.HTMLAttributes<HTMLDivElement>;

export function SectionStack({ className, children, ...props }: SectionStackProps) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {children}
    </div>
  );
}

export type InlineActionsProps = React.HTMLAttributes<HTMLDivElement>;

export function InlineActions({ className, children, ...props }: InlineActionsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export type TwoColumnGridProps = React.HTMLAttributes<HTMLDivElement>;

export function TwoColumnGrid({ className, children, ...props }: TwoColumnGridProps) {
  return (
    <div className={cn("grid gap-3 md:grid-cols-2", className)} {...props}>
      {children}
    </div>
  );
}
