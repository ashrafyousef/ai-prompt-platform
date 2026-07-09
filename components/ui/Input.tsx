import { forwardRef } from "react";
import { cn } from "@/lib/ui/cn";
import { uiTokens } from "@/lib/ui/tokens";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  variant?: "default" | "error";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, variant = "default", className, id, ...props },
  ref
) {
  const inputId = id ?? (label ? `${label.replace(/\s+/g, "-").toLowerCase()}-input` : undefined);
  const hasFieldMeta = Boolean(label || hint || error);
  const resolvedVariant = error ? "error" : variant;

  const input = (
    <input
      ref={ref}
      id={inputId}
      className={cn(
        "w-full min-w-0",
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
    return input;
  }

  return (
    <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
      {label ? <span>{label}</span> : null}
      {input}
      {error ? <span className="text-red-600 dark:text-red-400">{error}</span> : null}
      {!error && hint ? <span>{hint}</span> : null}
    </label>
  );
});
