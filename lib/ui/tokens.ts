export const uiTokens = {
  focusRing:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-950",
  surface: {
    page: "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
    card: "bg-white dark:bg-zinc-950",
    muted: "bg-zinc-50 dark:bg-zinc-900",
    elevated: "bg-white dark:bg-zinc-900",
  },
  border: {
    default: "border-zinc-200/80 dark:border-zinc-800",
    subtle: "border-zinc-100 dark:border-zinc-900",
    strong: "border-zinc-300 dark:border-zinc-700",
    danger: "border-red-200 dark:border-red-900/40",
    warning: "border-amber-200 dark:border-amber-900/40",
  },
  text: {
    primary: "text-zinc-900 dark:text-zinc-50",
    secondary: "text-zinc-700 dark:text-zinc-300",
    muted: "text-zinc-500 dark:text-zinc-400",
    danger: "text-red-700 dark:text-red-300",
    success: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-700 dark:text-amber-400",
  },
  shadow: {
    card: "shadow-sm",
    floating: "shadow-[0_10px_24px_rgba(0,0,0,0.08)]",
  },
  control: {
    base:
      "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
    compact: "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900",
  },
  alert: {
    danger:
      "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
    success: "text-sm text-emerald-700 dark:text-emerald-400",
  },
} as const;
