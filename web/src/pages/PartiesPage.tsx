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
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

const emptyParty = () => ({ name: "", role: "customer" as PartyRole, email: "", phone: "", notes: "" });

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [party, setParty] = useState(emptyParty);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(editingId ? `/api/parties/${editingId}` : "/api/parties", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(party),
      });
      const editing = Boolean(editingId);
      reset();
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
  }

  return <AppShell activePage="parties"><main className="app-main" id="app-main">
    <PageHeader kicker="Directory" title="Customers & suppliers" />
    <Card className="parties-card dedicated-card">
      <div className="transactions-heading"><div><p className="app-kicker">Business contacts</p><h2>Party directory</h2></div><p>Register the people and businesses you transact with once, then attach them to payments and expenses.</p></div>
      <div className="parties-layout">
        <form className="party-form" onSubmit={submit}>
          <div className="transaction-fields">
            <Label className="transaction-field"><span>Name</span><Input maxLength={120} autoComplete="organization" required value={party.name} onChange={(event) => setParty({ ...party, name: event.target.value })} disabled={busy} /></Label>
            <div className="transaction-field"><Label className="mb-[0.45rem] block text-[0.58rem]" htmlFor="party-role">Role</Label><Select value={party.role} onValueChange={(value) => setParty({ ...party, role: value as PartyRole })} disabled={busy}><SelectTrigger id="party-role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="supplier">Supplier</SelectItem><SelectItem value="both">Customer & supplier</SelectItem></SelectContent></Select></div>
          </div>
          <div className="transaction-fields">
            <Label className="transaction-field"><span>Email (optional)</span><Input type="email" maxLength={254} value={party.email} onChange={(event) => setParty({ ...party, email: event.target.value })} disabled={busy} /></Label>
            <Label className="transaction-field"><span>Phone (optional)</span><Input type="tel" maxLength={40} value={party.phone} onChange={(event) => setParty({ ...party, phone: event.target.value })} disabled={busy} /></Label>
          </div>
          <Label className="transaction-field"><span>Notes (optional)</span><Textarea maxLength={500} rows={3} value={party.notes} onChange={(event) => setParty({ ...party, notes: event.target.value })} disabled={busy} /></Label>
          <Button className="button button-primary" type="submit" disabled={busy}>{editingId ? "Save party" : "Register party"}</Button>
          {editingId && <Button className="button button-secondary" variant="secondary" type="button" onClick={reset}>Cancel edit</Button>}
          <p className="transaction-message" role="status" aria-live="polite">{message}</p>
        </form>
        <div className="party-directory">
          <div className="section-row"><h2>Registered</h2><span>{parties.length} {parties.length === 1 ? "party" : "parties"}</span></div>
          {parties.length === 0 ? <p className="transaction-empty">No customers or suppliers registered yet.</p> : parties.map((item) => <div className="party-row" key={item.id}>
            <div><strong>{item.name}</strong><small>{[item.email, item.phone].filter(Boolean).join(" · ") || "No contact details"}</small></div>
            <Badge className="party-role" variant="outline">{item.role === "both" ? "Customer & supplier" : item.role}</Badge>
            <div className="transaction-actions">
              <Button className="min-h-0" variant="ghost" size="sm" type="button" onClick={() => edit(item)}>Edit</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button className="transaction-delete min-h-0" variant="ghost" size="icon" type="button" aria-label={`Delete ${item.name}`}>×</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete party?</AlertDialogTitle><AlertDialogDescription>Delete {item.name} from the directory? Existing transactions will keep its name.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel asChild><Button variant="secondary" type="button">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button variant="destructive" type="button" onClick={() => remove(item)}>Delete party</Button></AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>)}
        </div>
      </div>
    </Card>
  </main></AppShell>;
}
