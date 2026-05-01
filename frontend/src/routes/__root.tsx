import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-svh grid grid-cols-[260px_1fr] bg-bg text-fg">
      <Sidebar />
      <main className="relative overflow-hidden">
        <div className="px-12 py-12 max-w-3xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="border-r border-border bg-surface/40 flex flex-col">
      <div className="px-6 pt-8 pb-10">
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
      <nav className="flex-1 px-3 pb-8">
        <SidebarHeader>Translation</SidebarHeader>
        <SidebarItem to="/text-translator" label="Text" />
        <SidebarItem to="/docx-translator" label="DOCX" />
        <SidebarHeader>Media</SidebarHeader>
        <SidebarItem to="/youtube-downloader" label="YouTube downloader" />
        <SidebarHeader>Developer</SidebarHeader>
        <SidebarItem to="/dev-tools" label="Dev tools" />
        <SidebarHeader>Personal</SidebarHeader>
        <SidebarItem to="/personal-hub" label="Notes & todos" />
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
