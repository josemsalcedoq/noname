import { useEffect, useState } from "react";
import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

const SIDEBAR_KEY = "sidebar:collapsed";

function RootLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_KEY) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <div
      className="min-h-svh grid bg-bg text-fg transition-[grid-template-columns] duration-200"
      style={{ gridTemplateColumns: collapsed ? "44px 1fr" : "260px 1fr" }}
    >
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      <main className="relative overflow-hidden">
        <div className="px-12 py-12 max-w-4xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  if (collapsed) {
    return (
      <aside className="border-r border-border bg-surface/40 flex flex-col items-center pt-3">
        <button
          type="button"
          onClick={onToggle}
          className="w-9 h-9 flex items-center justify-center font-mono text-sm text-muted hover:text-accent rounded-sm hover:bg-accent-soft"
          title="Show sidebar"
          aria-label="Show sidebar"
          data-testid="sidebar-toggle"
        >
          ›
        </button>
      </aside>
    );
  }

  return (
    <aside className="border-r border-border bg-surface/40 flex flex-col">
      <div className="px-6 pt-6 pb-8 flex items-start justify-between gap-2">
        <div>
          <Link
            to="/"
            className="font-mono text-base font-medium tracking-tight text-fg block"
          >
            <span className="text-accent">/</span>noname
          </Link>
          <p className="mt-1 font-serif italic text-xs text-muted">
            a personal utilities hub
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="w-7 h-7 flex items-center justify-center font-mono text-sm text-subtle hover:text-accent rounded-sm hover:bg-accent-soft -mt-1"
          title="Hide sidebar"
          aria-label="Hide sidebar"
          data-testid="sidebar-toggle"
        >
          ‹
        </button>
      </div>
      <nav className="flex-1 px-3 pb-8 overflow-y-auto">
        <SidebarHeader>Translation</SidebarHeader>
        <SidebarItem to="/text-translator" label="Text" />
        <SidebarItem to="/docx-translator" label="DOCX" />
        <SidebarItem to="/srt-translator" label="SRT subtitles" />
        <SidebarHeader>Media</SidebarHeader>
        <SidebarItem to="/youtube-downloader" label="YouTube downloader" />
        <SidebarItem to="/audio-transcriber" label="Audio transcriber" />
        <SidebarHeader>Documents</SidebarHeader>
        <SidebarItem to="/pdf-tools" label="PDF tools" />
        <SidebarHeader>Developer</SidebarHeader>
        <SidebarItem to="/dev-tools" label="Dev tools" />
        <SidebarItem to="/http-client" label="HTTP client" />
        <SidebarHeader>Personal</SidebarHeader>
        <SidebarItem to="/personal-hub" label="Notes & todos" />
        <SidebarHeader>Claude</SidebarHeader>
        <SidebarItem to="/skills" label="Skills catalog" />
      </nav>
      <div className="px-6 py-4 border-t border-border font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">
        local · single-user
      </div>
    </aside>
  );
}

function SidebarHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-subtle">
      {children}
    </h3>
  );
}

function SidebarItem({
  to,
  label,
  disabled,
}: {
  to: string;
  label: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span
        className="block px-3 py-1.5 font-mono text-sm text-subtle cursor-not-allowed select-none"
        title="not implemented yet"
      >
        {label}
      </span>
    );
  }
  return (
    <Link
      to={to}
      className="block px-3 py-1.5 font-mono text-sm text-muted hover:text-fg hover:bg-accent-soft rounded-sm transition-colors"
      activeProps={{ className: "block px-3 py-1.5 font-mono text-sm text-accent bg-accent-soft rounded-sm" }}
    >
      {label}
    </Link>
  );
}
