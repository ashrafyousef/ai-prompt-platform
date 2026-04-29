"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Ellipsis, LogOut, Shield, User } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";

type AccountMenuProps = {
  open: boolean;
  collapsed: boolean;
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
  onToggle: () => void;
  onClose: () => void;
};

function getInitials(name?: string | null, email?: string | null) {
  const source = (name?.trim() || email?.trim() || "U").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function AccountIdentity({
  userName,
  userEmail,
}: {
  userName?: string | null;
  userEmail?: string | null;
}) {
  const initials = getInitials(userName, userEmail);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/90 p-3 dark:border-zinc-700 dark:bg-zinc-800/80">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {userName || "Account"}
        </p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{userEmail || "Signed in user"}</p>
      </div>
    </div>
  );
}

function AccountActions({
  isAdmin,
  onClose,
}: {
  isAdmin: boolean;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 space-y-1.5">
      <Link
        href="/profile"
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
        onClick={onClose}
      >
        <User className="h-4 w-4" />
        Profile
      </Link>
      {isAdmin ? (
        <Link
          href="/admin"
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={onClose}
        >
          <Shield className="h-4 w-4" />
          Admin
        </Link>
      ) : null}
      <div className="my-1.5 h-px bg-zinc-200 dark:bg-zinc-700" />
      <SignOutButton
        callbackUrl="/sign-in"
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </SignOutButton>
    </div>
  );
}

export function AccountMenu({
  open,
  collapsed,
  userName,
  userEmail,
  isAdmin,
  onToggle,
  onClose,
}: AccountMenuProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const desktopPanelRef = useRef<HTMLDivElement | null>(null);
  const [desktopPosition, setDesktopPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const panelWidth = 320;
      const viewportPadding = 12;
      const gap = 8;
      const estimatedPanelHeight = desktopPanelRef.current?.offsetHeight ?? 300;

      // Prefer opening to the right of collapsed rail trigger when possible.
      const preferredLeft = collapsed ? rect.right + gap : rect.right - panelWidth;
      const maxLeft = window.innerWidth - panelWidth - viewportPadding;
      const left = Math.max(viewportPadding, Math.min(preferredLeft, maxLeft));

      // Prefer opening below trigger; if not enough room, open upward.
      const belowTop = rect.bottom + gap;
      const aboveTop = rect.top - estimatedPanelHeight - gap;
      const preferredTop =
        belowTop + estimatedPanelHeight <= window.innerHeight - viewportPadding ? belowTop : aboveTop;
      const maxTop = window.innerHeight - estimatedPanelHeight - viewportPadding;
      const top = Math.max(viewportPadding, Math.min(preferredTop, maxTop));

      setDesktopPosition({ left, top });
    }

    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, collapsed]);

  return (
    <>
      <button
        ref={triggerRef}
        className="flex w-full items-center justify-between rounded-md bg-zinc-100/85 px-3 py-2 text-xs text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        onClick={onToggle}
        aria-label="Profile menu"
      >
        {collapsed ? "•••" : userName ?? userEmail ?? "Profile & Settings"}
        {!collapsed ? <Ellipsis className="h-4 w-4" /> : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 hidden cursor-default bg-transparent lg:block"
            onClick={onClose}
            aria-label="Close account menu backdrop"
          />
          <div
            ref={desktopPanelRef}
            className="fixed z-40 hidden w-[320px] rounded-3xl border border-zinc-700/80 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur lg:block"
            style={desktopPosition ? { left: desktopPosition.left, top: desktopPosition.top } : undefined}
          >
            <AccountIdentity userName={userName} userEmail={userEmail} />
            <AccountActions isAdmin={isAdmin} onClose={onClose} />
          </div>

          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              onClick={onClose}
              aria-label="Close account menu"
            />
            <div className="absolute bottom-3 left-1/2 w-[calc(100vw-24px)] max-w-[560px] -translate-x-1/2 rounded-3xl border border-zinc-700/80 bg-zinc-900/95 p-4 shadow-2xl">
              <AccountIdentity userName={userName} userEmail={userEmail} />
              <AccountActions isAdmin={isAdmin} onClose={onClose} />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
