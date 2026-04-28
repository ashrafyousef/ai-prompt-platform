"use client";

import { useMemo } from "react";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return window.location.origin;
  }, []);

  return (
    <SessionProvider basePath="/api/auth" baseUrl={baseUrl}>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}
