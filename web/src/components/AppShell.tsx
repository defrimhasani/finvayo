import type { ReactNode } from "react";
import {
  ArrowLeftFromLine,
  ArrowRightLeft,
  ChartNoAxesCombined,
  CheckCheck,
  FileText,
  Gauge,
  Landmark,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Brand } from "./Brand";
import { Button } from "./ui/button";

type AppShellProps = {
  activePage:
    | "overview"
    | "transactions"
    | "parties"
    | "cash-plan"
    | "scenarios"
    | "reviews"
    | "invoices"
    | "settings";
  children: ReactNode;
  preview?: boolean;
};

const destinations = [
  ["overview", "/app", Gauge, "Overview"],
  ["transactions", "/app/transactions", ArrowRightLeft, "Transactions"],
  ["parties", "/app/parties", Users, "Parties"],
  ["invoices", "/app/invoices", FileText, "Invoices"],
  ["cash-plan", "/app/cash-plan", ChartNoAxesCombined, "Cash plan"],
  ["scenarios", "/app/scenarios", Landmark, "Scenarios"],
  ["reviews", "/app/reviews", CheckCheck, "Reviews"],
] as const;

export function AppShell({
  activePage,
  children,
  preview = false,
}: AppShellProps) {
  const user = window.__FINVAYO__?.user;
  return (
    <div className="min-h-dvh w-full min-[760px]:grid min-[760px]:grid-cols-[256px_minmax(0,1fr)]">
      <a className="fixed left-3 top-3 z-50 -translate-y-24 bg-white px-4 py-3 font-semibold text-black shadow-lg focus:translate-y-0" href="#app-main">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-[#171815] px-4 py-6 text-white min-[760px]:flex">
        <div className="mb-8 px-3 text-xl font-bold [&_a]:flex [&_a]:items-center [&_a]:gap-2 [&_a]:no-underline [&_svg]:size-7 [&_svg]:stroke-current [&_svg]:stroke-2">
          <Brand />
        </div>
        <nav className="flex flex-col gap-1" aria-label="Application navigation">
          {destinations.map(([key, href, Icon, label]) => (
            <a
              key={key}
              className={`flex min-h-11 items-center gap-3 px-3 text-sm font-semibold no-underline transition-colors hover:bg-white/10 focus-visible:outline-white ${activePage === key ? "bg-secondary text-secondary-foreground" : "text-white/75"}`}
              href={
                preview
                  ? key === "overview"
                    ? "/app/preview"
                    : "/signup"
                  : href
              }
              aria-current={activePage === key ? "page" : undefined}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" /> {label}
            </a>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 pt-6">
          {user?.isPlatformAdmin && !preview ? (
            <a className="flex min-h-11 items-center gap-3 px-3 text-sm font-semibold text-white/75 no-underline transition-colors hover:bg-white/10 focus-visible:outline-white" href="/admin">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" /> Platform admin
            </a>
          ) : null}
          <a
            className={`flex min-h-11 items-center gap-3 px-3 text-sm font-semibold no-underline transition-colors hover:bg-white/10 focus-visible:outline-white ${activePage === "settings" ? "bg-secondary text-secondary-foreground" : "text-white/75"}`}
            href={preview ? "/signup" : "/app/settings"}
            aria-current={activePage === "settings" ? "page" : undefined}
          >
            <Settings className="size-4 shrink-0" aria-hidden="true" /> Settings
          </a>
          {preview ? (
            <a className="flex min-h-11 items-center gap-3 px-3 text-sm font-semibold text-white/75 no-underline transition-colors hover:bg-white/10 focus-visible:outline-white" href="/login">
              <ArrowLeftFromLine className="size-4 shrink-0" aria-hidden="true" /> Leave preview
            </a>
          ) : (
            <form action="/auth/logout" method="post">
              <Button className="w-full justify-start px-3 text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-white" type="submit" variant="ghost">
                <ArrowLeftFromLine className="size-4 shrink-0" aria-hidden="true" /> Sign out
              </Button>
            </form>
          )}
          <div className="mt-4 flex min-w-0 items-center gap-3 border-t border-white/15 px-3 pt-5">
            <span className="grid size-9 shrink-0 place-items-center bg-secondary font-mono text-xs font-bold text-secondary-foreground">FV</span>
            <div className="min-w-0">
              <strong className="block truncate text-sm">{user?.workspaceName ?? "Demo workspace"}</strong>
              <small className="block truncate text-xs text-white/55">{user?.email ?? "Sample data"}</small>
            </div>
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur min-[760px]:hidden">
        <div className="[&_a]:flex [&_a]:items-center [&_a]:gap-2 [&_a]:font-bold [&_a]:no-underline [&_svg]:size-6">
          <Brand />
        </div>
        <a className="text-sm font-semibold underline" href={preview ? "/app/preview" : "/app"}>Overview</a>
      </header>
      <div className="min-w-0 w-full pb-24 min-[760px]:pb-0">{children}</div>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-20 items-stretch gap-1 overflow-x-auto border-t bg-[#171815] px-2 pb-[env(safe-area-inset-bottom)] text-white min-[760px]:hidden"
        aria-label="Mobile application navigation"
      >
        {destinations.map(([key, href, Icon, label]) => (
          <a
            key={key}
            className={`flex min-w-20 shrink-0 flex-col items-center justify-center gap-1 px-2 py-2 text-[0.68rem] font-semibold no-underline ${activePage === key ? "bg-secondary text-secondary-foreground" : "text-white/70"}`}
            href={
              preview ? (key === "overview" ? "/app/preview" : "/signup") : href
            }
            aria-current={activePage === key ? "page" : undefined}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </a>
        ))}
        <a
          className={`flex min-w-20 shrink-0 flex-col items-center justify-center gap-1 px-2 py-2 text-[0.68rem] font-semibold no-underline ${activePage === "settings" ? "bg-secondary text-secondary-foreground" : "text-white/70"}`}
          href={preview ? "/signup" : "/app/settings"}
          aria-current={activePage === "settings" ? "page" : undefined}
        >
          <Settings className="size-5" aria-hidden="true" /> Settings
        </a>
      </nav>
    </div>
  );
}
