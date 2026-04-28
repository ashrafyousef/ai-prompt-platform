"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Upload,
  Plus,
  BookOpen,
  Users,
  BarChart3,
  Menu,
  X,
} from "lucide-react";

const mainNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/members", label: "Members", icon: Users, exact: false },
  { href: "/admin/teams", label: "Teams", icon: Users, exact: false },
  { href: "/admin/agents", label: "Agents", icon: Bot, exact: false },
  { href: "/admin/knowledge", label: "Knowledge", icon: BookOpen, exact: false },
  { href: "/admin/agents/import", label: "Import Agent", icon: Upload, exact: true },
  { href: "/admin/agents/new", label: "Create Agent", icon: Plus, exact: true },
];

const futureNav = [
  { href: "#", label: "Analytics", icon: BarChart3, disabled: true },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  if (disabled) {
    return (
      <span className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-400 opacity-60 dark:text-zinc-500">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
        <span className="ml-auto text-[10px] font-medium uppercase tracking-wide">Soon</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export function AdminSidebar({
  mobileOpen,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const inner = (
    <>
      <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-4 dark:border-zinc-800">
        <Link href="/admin" className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Admin
        </Link>
        <button
          type="button"
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 md:hidden dark:hover:bg-zinc-800"
          onClick={onCloseMobile}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Workspace</p>
        {mainNav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(item.href, item.exact)}
            onClick={() => onCloseMobile()}
          />
        ))}
        <p className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Roadmap</p>
        {futureNav.map((item) => (
          <NavLink
            key={item.label}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={false}
            disabled={item.disabled}
          />
        ))}
      </nav>
      <div className="border-t border-zinc-200/80 p-4 dark:border-zinc-800">
        <div className="flex flex-col gap-2">
          <Link
            href="/profile"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            My profile
          </Link>
          <Link
            href="/chat"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to chat
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 md:flex">
        {inner}
      </aside>
      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-label="Close menu backdrop"
            onClick={onCloseMobile}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200/80 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
            {inner}
          </aside>
        </>
      ) : null}
    </>
  );
}

export function AdminMobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden"
      aria-label="Open admin menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
