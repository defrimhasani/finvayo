import type { ReactNode } from "react";

import { Brand } from "./Brand";

type AppShellProps = {
  activePage: "overview" | "transactions" | "parties" | "cash-plan" | "scenarios" | "reviews" | "invoices" | "settings";
  children: ReactNode;
  preview?: boolean;
};

const destinations = [
  ["overview", "/app", "⌂", "Overview"], ["transactions", "/app/transactions", "↔", "Transactions"], ["parties", "/app/parties", "◎", "Parties"], ["invoices", "/app/invoices", "▤", "Invoices"], ["cash-plan", "/app/cash-plan", "↗", "Cash plan"], ["scenarios", "/app/scenarios", "◇", "Scenarios"], ["reviews", "/app/reviews", "✓", "Reviews"],
] as const;

export function AppShell({ activePage, children, preview = false }: AppShellProps) {
  const user = window.__FINVAYO__?.user;
  return (
    <div className="app-page">
      <a className="skip-link" href="#app-main">Skip to content</a>
      <aside className="app-sidebar">
        <div className="app-wordmark"><Brand /></div>
        <nav className="app-nav" aria-label="Application navigation">
          {destinations.map(([key, href, icon, label]) => <a key={key} className={activePage === key ? "active" : ""} href={preview ? (key === "overview" ? "/app/preview" : "/signup") : href} aria-current={activePage === key ? "page" : undefined}><span aria-hidden="true">{icon}</span> {label}</a>)}
        </nav>
        <div className="sidebar-bottom">
          <a className={activePage === "settings" ? "active" : ""} href={preview ? "/signup" : "/app/settings"} aria-current={activePage === "settings" ? "page" : undefined}><span aria-hidden="true">⚙</span> Settings</a>
          {preview ? <a href="/login"><span aria-hidden="true">↪</span> Leave preview</a> : <form className="logout-form" action="/auth/logout" method="post"><button type="submit"><span aria-hidden="true">↪</span> Sign out</button></form>}
          <div className="user-chip"><span>FV</span><div><strong>{user?.workspaceName ?? "Demo workspace"}</strong><small>{user?.email ?? "Sample data"}</small></div></div>
        </div>
      </aside>
      <header className="mobile-app-header"><Brand /><a href={preview ? "/app/preview" : "/app"}>Overview</a></header>
      {children}
      <nav className="mobile-bottom-nav" aria-label="Mobile application navigation">
        {destinations.map(([key, href, icon, label]) => <a key={key} className={activePage === key ? "active" : ""} href={preview ? (key === "overview" ? "/app/preview" : "/signup") : href}><span aria-hidden="true">{icon}</span>{label}</a>)}
        <a className={activePage === "settings" ? "active" : ""} href={preview ? "/signup" : "/app/settings"}><span aria-hidden="true">⚙</span>Settings</a>
      </nav>
    </div>
  );
}
