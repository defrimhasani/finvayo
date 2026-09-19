import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "./api";
import { categories, categoryLabel, defaultCategory } from "./categories";
import { Button, Card, Choice, Eyebrow, Field, Notice } from "./components";
import { colors } from "./theme";
import type { CashEntry, Direction, Financials, Party } from "./types";
import { errorMessage, money, parseMoney, shortDate, today } from "./utils";

type EntryForm = { direction: Direction; name: string; amount: string; date: string; status: string; recurrence: "none" | "monthly"; category: string; partyId: string; invoiceReference: string };
type DirectionFilter = "all" | Direction;
type SortKey = "newest" | "oldest" | "amountHigh" | "amountLow" | "name";
export type PlanPrefill = { amountMinor: number; date: string };

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "newest", label: "Newest date" },
  { value: "oldest", label: "Oldest date" },
  { value: "amountHigh", label: "Highest amount" },
  { value: "amountLow", label: "Lowest amount" },
  { value: "name", label: "Name A-Z" },
];

function sortEntries(list: CashEntry[], sort: SortKey): CashEntry[] {
  const sorted = [...list];
  if (sort === "newest") sorted.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  else if (sort === "oldest") sorted.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  else if (sort === "amountHigh") sorted.sort((a, b) => b.amountMinor - a.amountMinor);
  else if (sort === "amountLow") sorted.sort((a, b) => a.amountMinor - b.amountMinor);
  else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

const initialForm = (direction: Direction = "inflow"): EntryForm => ({ direction, name: "", amount: "", date: today(), status: direction === "inflow" ? "expected" : "planned", recurrence: "none", category: defaultCategory(direction), partyId: "", invoiceReference: "" });

export function PlanScreen({ data, refresh, prefill, consumePrefill }: { data: Financials; refresh: () => Promise<void>; prefill: PlanPrefill | null; consumePrefill: () => void }) {
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [showBalance, setShowBalance] = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [balance, setBalance] = useState(data.snapshot ? String(data.snapshot.balanceMinor / 100) : "");
  const [balanceDate, setBalanceDate] = useState(today());
  const [form, setForm] = useState<EntryForm>(initialForm());
  const [editing, setEditing] = useState<CashEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [markPaidEntry, setMarkPaidEntry] = useState<CashEntry | null>(null);
  const [markPaidAmount, setMarkPaidAmount] = useState("");
  const [markPaidDate, setMarkPaidDate] = useState("");
  const [markPaidError, setMarkPaidError] = useState("");
  const [markPaidBusy, setMarkPaidBusy] = useState(false);

  useEffect(() => { void api.parties().then((result) => setParties(result.parties)).catch(() => {}); }, []);

  useEffect(() => {
    if (!prefill) return;
    setEditing(null);
    setForm({ ...initialForm("outflow"), name: "Scenario purchase", amount: String(prefill.amountMinor / 100), date: prefill.date, category: "equipment" });
    setError(""); setShowEntry(true);
    consumePrefill();
  }, [prefill]);

  const setDirection = (direction: Direction) => setForm((value) => ({ ...value, direction, status: direction === "inflow" ? "expected" : "planned", category: defaultCategory(direction), partyId: "", invoiceReference: "" }));
  const openEntry = (entry?: CashEntry) => {
    setEditing(entry || null);
    setForm(entry ? { direction: entry.direction, name: entry.name, amount: String(entry.amountMinor / 100), date: entry.scheduledDate, status: entry.storedStatus, recurrence: entry.recurrence || "none", category: entry.category || defaultCategory(entry.direction), partyId: entry.partyId || "", invoiceReference: entry.invoiceReference || "" } : initialForm());
    setError(""); setShowEntry(true);
  };
  const saveBalance = async () => {
    setBusy(true); setError("");
    try { await api.post("/api/cash-snapshots", { balanceMinor: parseMoney(balance), effectiveDate: balanceDate }); setShowBalance(false); await refresh(); }
    catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  const saveEntry = async () => {
    setBusy(true); setError("");
    const body = { direction: form.direction, name: form.name, amountMinor: parseMoney(form.amount), scheduledDate: form.date, status: form.status, recurrence: form.recurrence === "monthly" ? "monthly" : null, included: true, category: form.category, partyId: form.partyId || null, invoiceReference: form.direction === "inflow" ? form.invoiceReference : undefined };
    try { editing ? await api.patch(`/api/cash-entries/${editing.id}`, body) : await api.post("/api/cash-entries", body); setShowEntry(false); await refresh(); }
    catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  const remove = (entry: CashEntry) => Alert.alert("Delete entry?", `${entry.name} will be removed from your plan.`, [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await api.delete(`/api/cash-entries/${entry.id}`); await refresh(); } catch (caught) { Alert.alert("Could not delete", errorMessage(caught)); } } }]);
  const toggleIncluded = async (entry: CashEntry) => { try { await api.patch(`/api/cash-entries/${entry.id}`, { included: !entry.included }); await refresh(); } catch (caught) { Alert.alert("Could not update", errorMessage(caught)); } };
  const openMarkPaid = (entry: CashEntry) => { setMarkPaidEntry(entry); setMarkPaidAmount(String(entry.amountMinor / 100)); setMarkPaidDate(today()); setMarkPaidError(""); };
  const confirmMarkPaid = async () => {
    if (!markPaidEntry) return;
    const amountMinor = parseMoney(markPaidAmount);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) { setMarkPaidError("Enter a valid positive amount."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(markPaidDate)) { setMarkPaidError("Enter a valid date (YYYY-MM-DD)."); return; }
    setMarkPaidBusy(true); setMarkPaidError("");
    try { await api.patch(`/api/cash-entries/${markPaidEntry.id}`, { status: "paid", actualAmountMinor: amountMinor, actualDate: markPaidDate }); setMarkPaidEntry(null); await refresh(); }
    catch (caught) { setMarkPaidError(errorMessage(caught)); } finally { setMarkPaidBusy(false); }
  };

  const allowedParties = parties.filter((party) => party.role === (form.direction === "inflow" ? "customer" : "supplier") || party.role === "both");
  const active = data.entries.filter((entry) => entry.status !== "paid");
  const query = search.trim().toLowerCase();
  const filtered = active.filter((entry) => (directionFilter === "all" || entry.direction === directionFilter) && (!query || [entry.name, entry.partyName, entry.invoiceReference, categoryLabel(entry.direction, entry.category)].filter(Boolean).join(" ").toLowerCase().includes(query)));
  const visible = sortEntries(filtered, sort);
  const filtersActive = directionFilter !== "all" || search !== "" || sort !== "newest";
  const clearFilters = () => { setDirectionFilter("all"); setSearch(""); setSort("newest"); };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        <View><Eyebrow>Cash plan</Eyebrow><Text style={styles.title}>Keep the next 90 days honest.</Text></View>
        <Card dark>
          <Eyebrow light>Confirmed cash</Eyebrow>
          <Text style={styles.balance}>{data.snapshot ? money(data.snapshot.balanceMinor, data.currency) : "Not set"}</Text>
          <Text style={styles.darkBody}>{data.snapshot ? `Effective ${shortDate(data.snapshot.effectiveDate)}` : "Add the real balance available to the business today."}</Text>
          <Button label={data.snapshot ? "Refresh balance" : "Confirm cash"} onPress={() => { setError(""); setShowBalance(true); }} />
        </Card>
        <View style={styles.actions}><Button label="Add money in" onPress={() => { openEntry(); setDirection("inflow"); }} /><Button label="Add money out" secondary onPress={() => { openEntry(); setDirection("outflow"); }} /></View>
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name, party, invoice, category" autoCapitalize="none" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {([{ value: "all", label: "all" }, { value: "inflow", label: "money in" }, { value: "outflow", label: "money out" }] as Array<{ value: DirectionFilter; label: string }>).map((option) => <Pressable key={option.value} onPress={() => setDirectionFilter(option.value)} style={[styles.filter, directionFilter === option.value && styles.filterActive]}><Text style={[styles.filterText, directionFilter === option.value && styles.filterTextActive]}>{option.label}</Text></Pressable>)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {SORTS.map((option) => <Pressable key={option.value} onPress={() => setSort(option.value)} style={[styles.filter, sort === option.value && styles.filterActive]}><Text style={[styles.filterText, sort === option.value && styles.filterTextActive]}>{option.label}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Upcoming entries</Text>
          <View style={styles.headActions}>{filtersActive ? <Pressable onPress={clearFilters}><Text style={styles.deleteLink}>Clear filters</Text></Pressable> : null}<Text style={styles.count}>{visible.length === active.length ? visible.length : `${visible.length} of ${active.length}`}</Text></View>
        </View>
        {visible.length ? visible.map((entry) => (
          <Card key={entry.id}>
            <View style={styles.entryTop}><View style={[styles.direction, entry.direction === "inflow" ? styles.inflow : styles.outflow]}><Text style={styles.directionText}>{entry.direction === "inflow" ? "Money in" : "Money out"}</Text></View><Text style={styles.amount}>{entry.direction === "outflow" ? "−" : "+"}{money(entry.amountMinor, data.currency)}</Text></View>
            <Text style={styles.entryName}>{entry.name}</Text><Text style={styles.meta}>{shortDate(entry.scheduledDate)} · {entry.status}{entry.recurrence ? " · monthly" : ""} · {categoryLabel(entry.direction, entry.category)}{entry.partyName ? ` · ${entry.partyName}` : ""}</Text>
            {!entry.included ? <Notice>Excluded from your forecast.</Notice> : null}
            <View style={styles.entryActions}><Pressable onPress={() => openEntry(entry)}><Text style={styles.link}>Edit</Text></Pressable><Pressable onPress={() => toggleIncluded(entry)}><Text style={styles.link}>{entry.included ? "Exclude" : "Include"}</Text></Pressable><Pressable onPress={() => openMarkPaid(entry)}><Text style={styles.link}>Mark paid</Text></Pressable><Pressable onPress={() => remove(entry)}><Text style={[styles.link, styles.delete]}>Delete</Text></Pressable></View>
          </Card>
        )) : <Card><Text style={styles.empty}>{active.length ? "No entries match these filters." : "No upcoming entries. Add expected income and planned expenses to make your outlook useful."}</Text></Card>}
      </ScrollView>
      <Modal visible={showBalance} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBalance(false)}><ScrollView contentContainerStyle={styles.modal}><Eyebrow>Cash baseline</Eyebrow><Text style={styles.title}>What is in the bank?</Text><Text style={styles.help}>Use the balance available to this business. This becomes the starting point for the forecast.</Text>{error ? <Notice error>{error}</Notice> : null}<Field label="Current cash" value={balance} onChangeText={setBalance} keyboardType="decimal-pad" placeholder="0.00" /><Field label="Effective date (YYYY-MM-DD)" value={balanceDate} onChangeText={setBalanceDate} /><Button label={busy ? "Saving..." : "Confirm balance"} disabled={busy} onPress={saveBalance} /><Button label="Cancel" secondary onPress={() => setShowBalance(false)} /></ScrollView></Modal>
      <Modal visible={showEntry} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEntry(false)}>
        <ScrollView contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled">
          <Eyebrow>{editing ? "Edit entry" : "New entry"}</Eyebrow><Text style={styles.title}>{form.direction === "inflow" ? "Expected income" : "Planned expense"}</Text>
          {error ? <Notice error>{error}</Notice> : null}
          <Choice value={form.direction} options={[{ value: "inflow", label: "Money in" }, { value: "outflow", label: "Money out" }]} onChange={setDirection} />
          <Field label="Description" value={form.name} onChangeText={(name) => setForm((value) => ({ ...value, name }))} placeholder={form.direction === "inflow" ? "Client payment" : "Software subscription"} />
          <Field label="Amount" value={form.amount} onChangeText={(amount) => setForm((value) => ({ ...value, amount }))} keyboardType="decimal-pad" placeholder="0.00" />
          <Field label="Date (YYYY-MM-DD)" value={form.date} onChangeText={(date) => setForm((value) => ({ ...value, date }))} />
          <Text style={styles.fieldLabel}>Category</Text>
          <Choice value={form.category} options={categories[form.direction].map(([value, label]) => ({ value, label }))} onChange={(category) => setForm((value) => ({ ...value, category }))} />
          <Text style={styles.fieldLabel}>{form.direction === "inflow" ? "Customer" : "Supplier"}</Text>
          <View style={styles.partyList}>
            <Pressable onPress={() => setForm((value) => ({ ...value, partyId: "" }))} style={[styles.party, form.partyId === "" && styles.partyActive]}><Text style={styles.itemName}>{`No registered ${form.direction === "inflow" ? "customer" : "supplier"}`}</Text></Pressable>
            {allowedParties.map((party) => <Pressable key={party.id} onPress={() => setForm((value) => ({ ...value, partyId: party.id }))} style={[styles.party, form.partyId === party.id && styles.partyActive]}><Text style={styles.itemName}>{party.name}</Text></Pressable>)}
          </View>
          {form.direction === "inflow" ? <Field label="Invoice reference (optional)" value={form.invoiceReference} onChangeText={(invoiceReference) => setForm((value) => ({ ...value, invoiceReference }))} /> : null}
          {form.direction === "inflow" ? <><Text style={styles.fieldLabel}>Status</Text><Choice value={form.status as "expected" | "invoiced" | "unlikely"} options={[{ value: "expected", label: "Expected" }, { value: "invoiced", label: "Invoiced" }, { value: "unlikely", label: "Unlikely" }]} onChange={(status) => setForm((value) => ({ ...value, status }))} /></> : null}
          <Text style={styles.fieldLabel}>Repeat</Text><Choice value={form.recurrence} options={[{ value: "none", label: "Once" }, { value: "monthly", label: "Monthly" }]} onChange={(recurrence) => setForm((value) => ({ ...value, recurrence }))} />
          <Button label={busy ? "Saving..." : editing ? "Save changes" : "Add to plan"} disabled={busy || !form.name || !form.amount} onPress={saveEntry} /><Button label="Cancel" secondary onPress={() => setShowEntry(false)} />
        </ScrollView>
      </Modal>
      <Modal visible={markPaidEntry !== null} animationType="fade" transparent onRequestClose={() => setMarkPaidEntry(null)}>
        <View style={styles.overlay}><View style={styles.dialog}>
          <Eyebrow>Mark transaction paid</Eyebrow>
          <Text style={styles.sectionTitle}>{markPaidEntry?.name}</Text>
          {markPaidError ? <Notice error>{markPaidError}</Notice> : null}
          <Field label="Actual amount" value={markPaidAmount} onChangeText={setMarkPaidAmount} keyboardType="decimal-pad" placeholder="0.00" />
          <Field label="Actual date (YYYY-MM-DD)" value={markPaidDate} onChangeText={setMarkPaidDate} />
          <Button label={markPaidBusy ? "Saving..." : "Mark paid"} disabled={markPaidBusy} onPress={confirmMarkPaid} />
          <Button label="Cancel" secondary onPress={() => setMarkPaidEntry(null)} />
        </View></View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 120, gap: 18 }, modal: { padding: 24, paddingTop: 60, gap: 16, backgroundColor: colors.paper, flexGrow: 1 },
  title: { fontFamily: "Newsreader_700Bold", fontSize: 38, lineHeight: 42, color: colors.ink, marginTop: 5 },
  balance: { fontFamily: "SpaceMono_700Bold", color: colors.white, fontSize: 34 }, darkBody: { fontFamily: "Manrope_500Medium", color: "#C8D2CD" },
  actions: { gap: 10 },
  filters: { gap: 8 }, filter: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.card }, filterActive: { backgroundColor: colors.acid, borderColor: colors.ink }, filterText: { fontFamily: "SpaceMono_700Bold", color: colors.muted, fontSize: 10, textTransform: "uppercase" }, filterTextActive: { color: colors.ink },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, headActions: { flexDirection: "row", alignItems: "center", gap: 12 }, sectionTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 20 }, count: { fontFamily: "SpaceMono_700Bold", color: colors.teal }, deleteLink: { fontFamily: "Manrope_700Bold", color: colors.danger },
  entryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, direction: { paddingHorizontal: 9, paddingVertical: 5 }, inflow: { backgroundColor: colors.acid }, outflow: { backgroundColor: "#FFD8C9" }, directionText: { fontFamily: "SpaceMono_700Bold", textTransform: "uppercase", fontSize: 9 }, amount: { fontFamily: "SpaceMono_700Bold", fontSize: 16 }, entryName: { fontFamily: "Manrope_800ExtraBold", fontSize: 18 }, meta: { fontFamily: "Manrope_500Medium", color: colors.muted },
  entryActions: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 18 }, link: { fontFamily: "Manrope_700Bold", color: colors.teal, fontSize: 13 }, delete: { color: colors.danger }, empty: { fontFamily: "Manrope_500Medium", color: colors.muted, lineHeight: 22 }, help: { fontFamily: "Manrope_500Medium", color: colors.muted, lineHeight: 22 }, fieldLabel: { fontFamily: "Manrope_700Bold", fontSize: 13, color: colors.ink },
  itemName: { fontFamily: "Manrope_700Bold", color: colors.ink }, partyList: { gap: 8 }, party: { borderWidth: 1, borderColor: colors.line, padding: 12, backgroundColor: colors.card }, partyActive: { borderColor: colors.ink, backgroundColor: "#F4F6DA" },
  overlay: { flex: 1, backgroundColor: "rgba(23,24,21,0.65)", justifyContent: "center", padding: 20 }, dialog: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.ink, padding: 20, gap: 15 },
});
