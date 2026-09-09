import { FormEvent, useEffect, useState } from "react";

import { api } from "../api";
import { fail, type Party, type PartyRole, PageHeader } from "../appData";
import { AppShell } from "../components/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

const emptyParty = () => ({ name: "", role: "customer" as PartyRole, email: "", phone: "", notes: "" });

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [party, setParty] = useState(emptyParty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setParties((await api<{ parties: Party[] }>("/api/parties")).parties);
  }

  useEffect(() => {
    load().catch((error) => setMessage(fail(error, "Unable to load parties.")));
  }, []);

  function reset() {
    setEditingId(null);
    setParty(emptyParty());
  }

  function closeEditor() {
    setEditorOpen(false);
    reset();
    setMessage("");
  }

  function create() {
    reset();
    setMessage("");
    setEditorOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(editingId ? `/api/parties/${editingId}` : "/api/parties", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(party),
      });
      const editing = Boolean(editingId);
      closeEditor();
      await load();
      setMessage(editing ? "Party updated." : "Party registered.");
    } catch (error) {
      setMessage(fail(error, "Unable to save party."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Party) {
    try {
      await api(`/api/parties/${item.id}`, { method: "DELETE" });
      await load();
      setMessage("Party deleted. Historical transactions were preserved.");
    } catch (error) {
      setMessage(fail(error, "Unable to delete party."));
    }
  }

  function edit(item: Party) {
    setEditingId(item.id);
    setParty({ name: item.name, role: item.role, email: item.email || "", phone: item.phone || "", notes: item.notes || "" });
    setMessage("");
    setEditorOpen(true);
  }

  const fieldClass = "grid min-w-0 gap-2 [&>label]:font-mono [&>label]:text-[0.7rem] [&>label]:uppercase [&>label]:tracking-[0.06em] [&>label]:text-muted-foreground [&>span]:font-mono [&>span]:text-[0.7rem] [&>span]:uppercase [&>span]:tracking-[0.06em] [&>span]:text-muted-foreground";

  return <AppShell activePage="parties"><main className="min-h-screen w-full px-4 pb-28 pt-6 min-[761px]:px-6 min-[761px]:pb-20 min-[761px]:pt-8 min-[1200px]:px-8" id="app-main">
    <PageHeader kicker="Directory" title="Customers & suppliers"><Button type="button" onClick={create}>New party</Button></PageHeader>
    <Card className="mt-5 bg-muted p-[clamp(1.5rem,3vw,2.5rem)]">
      <div className="flex items-end justify-between gap-8 max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-3"><div><p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-[#3f665e]">Business contacts</p><h2 className="text-[1.4rem] font-semibold tracking-[-0.045em]">Party directory</h2></div><p className="max-w-[470px] text-sm leading-6 text-muted-foreground">Register the people and businesses you transact with once, then attach them to payments and expenses.</p></div>
      <div className="mt-8">
        <div className="min-w-0">
          <div className="flex items-end justify-between gap-4 border-b border-border pb-4"><h2 className="text-[1.4rem] font-semibold tracking-[-0.045em]">Registered</h2><span className="shrink-0 font-mono text-xs uppercase text-muted-foreground">{parties.length} {parties.length === 1 ? "party" : "parties"}</span></div>
          {parties.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No customers or suppliers registered yet.</p> : parties.map((item) => <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-t border-border py-4 max-[620px]:grid-cols-[minmax(0,1fr)_auto]" key={item.id}>
            <div className="min-w-0 [overflow-wrap:anywhere]"><strong className="mb-1 block text-sm">{item.name}</strong><small className="block text-xs leading-5 text-muted-foreground">{[item.email, item.phone].filter(Boolean).join(" · ") || "No contact details"}</small></div>
            <Badge className="max-w-40 whitespace-normal text-center font-mono uppercase" variant="outline">{item.role === "both" ? "Customer & supplier" : item.role}</Badge>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 max-[620px]:col-span-full max-[620px]:justify-start">
              <Button className="min-h-0" variant="ghost" size="sm" type="button" onClick={() => edit(item)}>Edit</Button>
              <AlertDialog>
                <AlertDialogTrigger render={<Button className="min-h-0 text-destructive hover:bg-destructive/10" variant="ghost" size="icon" type="button" aria-label={`Delete ${item.name}`} />}>×</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete party?</AlertDialogTitle><AlertDialogDescription>Delete {item.name} from the directory? Existing transactions will keep its name.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel variant="secondary" type="button">Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" type="button" onClick={() => remove(item)}>Delete party</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>)}
        </div>
        {!editorOpen && <p className="mt-4 min-h-5 text-sm text-[#3f665e]" role="status" aria-live="polite">{message}</p>}
      </div>
    </Card>
    <Dialog open={editorOpen} onOpenChange={(open) => {
      if (!open && !busy) closeEditor();
    }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit party" : "New party"}</DialogTitle>
          <DialogDescription>{editingId ? "Update this party's directory details." : "Add a customer, supplier, or both to your directory."}</DialogDescription>
        </DialogHeader>
        <form className="grid min-w-0 content-start gap-3" id="party-form" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
            <Label className={fieldClass}><span>Name</span><Input maxLength={120} autoComplete="organization" required value={party.name} onChange={(event) => setParty({ ...party, name: event.target.value })} disabled={busy} autoFocus /></Label>
            <div className={fieldClass}><Label htmlFor="party-role">Role</Label><Select value={party.role} onValueChange={(value) => setParty({ ...party, role: (value ?? "customer") as PartyRole })} disabled={busy}><SelectTrigger id="party-role"><SelectValue>{() => party.role === "both" ? "Customer & supplier" : party.role === "supplier" ? "Supplier" : "Customer"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="supplier">Supplier</SelectItem><SelectItem value="both">Customer & supplier</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-1">
            <Label className={fieldClass}><span>Email (optional)</span><Input type="email" maxLength={254} value={party.email} onChange={(event) => setParty({ ...party, email: event.target.value })} disabled={busy} /></Label>
            <Label className={fieldClass}><span>Phone (optional)</span><Input type="tel" maxLength={40} value={party.phone} onChange={(event) => setParty({ ...party, phone: event.target.value })} disabled={busy} /></Label>
          </div>
          <Label className={fieldClass}><span>Notes (optional)</span><Textarea maxLength={500} rows={3} value={party.notes} onChange={(event) => setParty({ ...party, notes: event.target.value })} disabled={busy} /></Label>
          <p className="min-h-5 text-sm text-[#3f665e]" role="status" aria-live="polite">{message}</p>
        </form>
        <DialogFooter>
          <Button variant="secondary" type="button" onClick={closeEditor} disabled={busy}>Cancel</Button>
          <Button type="submit" form="party-form" disabled={busy}>{busy ? "Saving..." : editingId ? "Save party" : "Register party"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main></AppShell>;
}
