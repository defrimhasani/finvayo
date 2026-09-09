import type { ReactNode } from "react";

import { Brand } from "./Brand";

type AppShellProps = {
  activePage: "overview" | "invoices" | "settings";
  children: ReactNode;
};

export function AppShell({ activePage, children }: AppShellProps) {
  const user = window.__FINVAYO__?.user;
  return (
    <div className="app-page">
      <a className="skip-link" href="#app-main">Skip to content</a>
      <aside className="app-sidebar">
        <div className="app-wordmark"><Brand /></div>
        <nav className="app-nav" aria-label="Application navigation">
          <a className={activePage === "overview" ? "active" : ""} href="/app" aria-current={activePage === "overview" ? "page" : undefined}><span aria-hidden="true">⌂</span> Overview</a>
          <a href="/app#parties"><span aria-hidden="true">◎</span> Parties</a>
          <a className={activePage === "invoices" ? "active" : ""} href="/app/invoices" aria-current={activePage === "invoices" ? "page" : undefined}><span aria-hidden="true">▤</span> Invoices</a>
          <a href="/app#cash-plan"><span aria-hidden="true">↗</span> Cash plan</a>
        </nav>
        <div className="sidebar-bottom">
          <a className={activePage === "settings" ? "active" : ""} href="/app/settings" aria-current={activePage === "settings" ? "page" : undefined}><span aria-hidden="true">⚙</span> Settings</a>
          <form className="logout-form" action="/auth/logout" method="post"><button type="submit"><span aria-hidden="true">↪</span> Sign out</button></form>
          <div className="user-chip"><span>FV</span><div><strong>{user?.workspaceName ?? "Workspace"}</strong><small>{user?.email ?? ""}</small></div></div>
        </div>
      </aside>
      <header className="mobile-app-header"><Brand /><a href="/app">Overview</a></header>
      {children}
      <nav className="mobile-bottom-nav settings-mobile-nav" aria-label="Mobile application navigation">
        <a className={activePage === "overview" ? "active" : ""} href="/app"><span aria-hidden="true">⌂</span>Overview</a>
        <a href="/app#parties"><span aria-hidden="true">◎</span>Parties</a>
        <a className={activePage === "invoices" ? "active" : ""} href="/app/invoices"><span aria-hidden="true">▤</span>Invoices</a>
        <a className={activePage === "settings" ? "active" : ""} href="/app/settings"><span aria-hidden="true">⚙</span>Settings</a>
      </nav>
    </div>
  );
}
