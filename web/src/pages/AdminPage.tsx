import { FormEvent, useEffect, useState } from "react";
import { Building2, LogOut, Search, ShieldCheck } from "lucide-react";

import { api } from "../api";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

type Workspace = {
  id: string;
  name: string;
  currency: string;
  createdAt: number;
  ownerEmail: string;
  stripeStatus: string;
  stripeSubscriptionId: string | null;
  manualAccessEnabled: number;
  manualAccessNote: string | null;
  manualAccessUpdatedAt: number | null;
  manualAccessUpdatedBy: string | null;
};

export function AdminPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load(search = "") {
    setLoading(true);
    setMessage("");
    try {
      const result = await api<{ workspaces: Workspace[] }>(`/api/admin/workspaces?q=${encodeURIComponent(search)}`);
      setWorkspaces(result.workspaces);
      setNotes(Object.fromEntries(result.workspaces.map((workspace) => [workspace.id, workspace.manualAccessNote ?? ""])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load businesses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function search(event: FormEvent) {
    event.preventDefault();
    await load(query);
  }

  async function setManualAccess(workspace: Workspace, enabled: boolean) {
    setBusyId(workspace.id);
    setMessage("");
    try {
      await api(`/api/admin/workspaces/${workspace.id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ enabled, note: notes[workspace.id] ?? "" }),
      });
      await load(query);
      setMessage(`${workspace.name} ${enabled ? "now has" : "no longer has"} manual premium access.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update premium access.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-dvh bg-[#f2efe8] text-foreground" id="app-main">
      <header className="border-b border-white/15 bg-[#171815] px-4 py-5 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center bg-secondary text-secondary-foreground"><ShieldCheck className="size-5" /></span><div><p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-white/55">Restricted operations</p><strong>Finvayo platform admin</strong></div></div>
          <form action="/auth/logout" method="post"><Button className="text-white hover:bg-white/10 hover:text-white" type="submit" variant="ghost"><LogOut className="size-4" /> Sign out</Button></form>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <div className="grid gap-6 border-b border-foreground pb-8 md:grid-cols-[1fr_420px] md:items-end">
          <div><p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-[#3f665e]">Platform administration</p><h1 className="text-[clamp(2.5rem,6vw,5.5rem)] font-semibold leading-none tracking-[-0.065em]">Workspaces</h1><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Find and manage every Finvayo workspace. Grant premium access for offline arrangements without changing its Stripe subscription.</p></div>
          <form className="flex gap-2" onSubmit={search}><Label className="sr-only" htmlFor="admin-search">Search businesses</Label><Input id="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business or owner email" /><Button type="submit" disabled={loading}><Search className="size-4" /> Search</Button></form>
        </div>
        <p className={`min-h-10 py-3 text-sm ${message.includes("Unable") || message.includes("Forbidden") ? "text-destructive" : "text-[#225c50]"}`} role="status" aria-live="polite">{message}</p>
        <section className="grid gap-4" aria-busy={loading} aria-label="Businesses">
          {!loading && workspaces.length === 0 ? <Card className="p-8 text-center text-muted-foreground">No businesses match this search.</Card> : null}
          {workspaces.map((workspace) => {
            const manual = Boolean(workspace.manualAccessEnabled);
            const stripeActive = ["active", "trialing"].includes(workspace.stripeStatus);
            return <Card key={workspace.id} className="grid gap-5 p-5 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)_auto] lg:items-center">
              <div className="min-w-0"><div className="mb-2 flex items-center gap-2"><Building2 className="size-4 text-[#3f665e]" /><h2 className="truncate text-lg font-semibold">{workspace.name}</h2></div><p className="truncate text-sm text-muted-foreground">{workspace.ownerEmail}</p><p className="mt-2 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">Joined {new Date(workspace.createdAt * 1000).toLocaleDateString()} · {workspace.currency}</p></div>
              <div><div className="mb-3 flex flex-wrap gap-2"><Badge variant={manual ? "success" : "outline"}>{manual ? "Manual premium" : "No manual access"}</Badge><Badge variant={stripeActive ? "success" : "outline"}>Stripe: {workspace.stripeStatus.replaceAll("_", " ")}</Badge></div><Label className="sr-only" htmlFor={`note-${workspace.id}`}>Internal note for {workspace.name}</Label><Input id={`note-${workspace.id}`} value={notes[workspace.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [workspace.id]: event.target.value }))} maxLength={500} placeholder="Internal note, e.g. cash received" disabled={busyId === workspace.id} />{workspace.manualAccessUpdatedAt ? <p className="mt-2 text-xs text-muted-foreground">Last changed {new Date(workspace.manualAccessUpdatedAt * 1000).toLocaleString()}{workspace.manualAccessUpdatedBy ? ` by ${workspace.manualAccessUpdatedBy}` : ""}</p> : null}</div>
              <Button className="lg:min-w-40" variant={manual ? "destructive" : "default"} disabled={busyId !== null} onClick={() => void setManualAccess(workspace, !manual)}>{busyId === workspace.id ? "Updating..." : manual ? "Revoke manual access" : "Enable premium"}</Button>
            </Card>;
          })}
        </section>
      </div>
    </main>
  );
}

export default AdminPage;
