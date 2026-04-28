"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({
  className,
  callbackUrl = "/sign-in",
  children,
}: {
  className?: string;
  callbackUrl?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      className={className}
    >
      {children}
    </button>
  );
}
