import { forwardRef } from "react";
import { cn } from "@/lib/ui/cn";
import { uiTokens } from "@/lib/ui/tokens";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  variant?: "default" | "error";
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, variant = "default", className, id, ...props },
  ref
) {
  const textareaId = id ?? (label ? `${label.replace(/\s+/g, "-").toLowerCase()}-textarea` : undefined);
  const hasFieldMeta = Boolean(label || hint || error);
  const resolvedVariant = error ? "error" : variant;

  const textarea = (
    <textarea
      ref={ref}
      id={textareaId}
      className={cn(
        "w-full min-w-0 min-h-[5rem] resize-y",
        uiTokens.control.base,
        uiTokens.focusRing,
        resolvedVariant === "error" && "border-red-400 dark:border-red-700",
        className
      )}
      aria-invalid={resolvedVariant === "error" ? true : undefined}
      {...props}
    />
  );

  if (!hasFieldMeta) {
    return textarea;
  }

  return (
    <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
      {label ? <span>{label}</span> : null}
      {textarea}
      {error ? <span className="text-red-600 dark:text-red-400">{error}</span> : null}
      {!error && hint ? <span>{hint}</span> : null}
    </label>
  );
});
