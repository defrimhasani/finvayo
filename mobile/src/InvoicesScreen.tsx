import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./api";
import { Button, Card, Choice, Eyebrow, Field, Notice } from "./components";
import { colors } from "./theme";
import type { Invoice, InvoiceSummary, Party } from "./types";
import { errorMessage, money, parseMoney, shortDate, today } from "./utils";

type Filter = "all" | "draft" | "sent" | "overdue" | "paid";
type SortKey = "newest" | "dueSoonest" | "dueLatest" | "amountHigh" | "amountLow" | "customer";
type DraftItem = { key: string; description: string; quantity: string; unitPrice: string };
type Draft = { customerId: string; issueDate: string; dueDate: string; taxRate: string; notes: string; items: DraftItem[] };

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "dueSoonest", label: "Due soonest" },
  { value: "dueLatest", label: "Due latest" },
  { value: "amountHigh", label: "Highest amount" },
  { value: "amountLow", label: "Lowest amount" },
  { value: "customer", label: "Customer" },
];

function sortInvoices(list: InvoiceSummary[], sort: SortKey): InvoiceSummary[] {
  if (sort === "newest") return list;
  const sorted = [...list];
  if (sort === "dueSoonest") sorted.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  else if (sort === "dueLatest") sorted.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  else if (sort === "amountHigh") sorted.sort((a, b) => b.totalMinor - a.totalMinor);
  else if (sort === "amountLow") sorted.sort((a, b) => a.totalMinor - b.totalMinor);
  else if (sort === "customer") sorted.sort((a, b) => a.customerName.localeCompare(b.customerName));
  return sorted;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function blankItem(): DraftItem {
  return { key: `${Date.now()}-${Math.random()}`, description: "", quantity: "1", unitPrice: "" };
}

function blankDraft(): Draft {
  const issueDate = today();
  return { customerId: "", issueDate, dueDate: addDays(issueDate, 14), taxRate: "0", notes: "", items: [blankItem()] };
}

export function InvoicesScreen({ currency, refreshFinancials }: { currency?: string; refreshFinancials: () => Promise<void> }) {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [paidDate, setPaidDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [invoiceData, partyData] = await Promise.all([api.invoices(), api.parties()]);
      setInvoices(invoiceData.invoices);
      setCustomers(partyData.parties.filter((party) => party.role === "customer" || party.role === "both"));
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };
  useEffect(() => { void load(); }, []);

  const openNew = () => { setDraft(blankDraft()); setEditingId(null); setError(""); setMessage(""); setShowEditor(true); };
  const openDetail = async (id: string) => { setBusy(true); setError(""); try { setSelected((await api.invoice(id)).invoice); } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); } };
  const edit = (invoice: Invoice) => {
    setDraft({ customerId: invoice.customerId, issueDate: invoice.issueDate, dueDate: invoice.dueDate, taxRate: String(invoice.taxRateBasisPoints / 100), notes: invoice.notes || "", items: invoice.items.map((item) => ({ key: item.id || `${item.position}`, description: item.description, quantity: String(item.quantityMilli / 1000), unitPrice: String(item.unitPriceMinor / 100) })) });
    setEditingId(invoice.id); setSelected(null); setError(""); setShowEditor(true);
  };
  const updateItem = (key: string, changes: Partial<DraftItem>) => setDraft((value) => ({ ...value, items: value.items.map((item) => item.key === key ? { ...item, ...changes } : item) }));
  const subtotal = draft.items.reduce((sum, item) => sum + Math.round((Number(item.quantity) || 0) * (parseMoney(item.unitPrice) || 0)), 0);
  const total = subtotal + Math.round(subtotal * (Number(draft.taxRate) || 0) / 100);
  const save = async () => {
    setBusy(true); setError("");
    const body = { customerId: draft.customerId, issueDate: draft.issueDate, dueDate: draft.dueDate, taxRateBasisPoints: Math.round(Number(draft.taxRate) * 100), notes: draft.notes, items: draft.items.map((item) => ({ description: item.description, quantity: Number(item.quantity), unitPriceMinor: parseMoney(item.unitPrice) })) };
    try {
      const result = editingId ? await api.patch<{ id: string }>(`/api/invoices/${editingId}`, body) : await api.post<{ id: string }>("/api/invoices", body);
      setShowEditor(false); await load(); await openDetail(result.id);
    } catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  const send = async (invoice: Invoice) => {
    setBusy(true); setError(""); setMessage("");
    try { await api.post(`/api/invoices/${invoice.id}/send`, {}); setMessage("Invoice emailed to the customer."); await load(); await openDetail(invoice.id); }
    catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  const markPaid = async (invoice: Invoice) => {
    setBusy(true); setError("");
    try { await api.post(`/api/invoices/${invoice.id}/paid`, { paidDate }); setMessage("Invoice marked paid. Confirm current cash when the payment reaches your bank."); await load(); await refreshFinancials(); await openDetail(invoice.id); }
    catch (caught) { setError(errorMessage(caught)); } finally { setBusy(false); }
  };
  const remove = (invoice: Invoice) => Alert.alert("Delete draft?", `${invoice.invoiceNumber} will be permanently removed.`, [{ text: "Keep", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { try { await api.delete(`/api/invoices/${invoice.id}`); setSelected(null); await load(); } catch (caught) { setError(errorMessage(caught)); } } }]);
  const confirmMarkPaid = (invoice: Invoice) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) { setError("Enter a valid payment date (YYYY-MM-DD)."); return; }
    setError("");
    Alert.alert("Mark invoice paid?", `${invoice.invoiceNumber} for ${money(invoice.totalMinor, invoice.currency)} will be recorded as paid on ${paidDate}.`, [{ text: "Cancel", style: "cancel" }, { text: "Mark paid", onPress: () => void markPaid(invoice) }]);
  };
  const query = search.trim().toLowerCase();
  const filtered = invoices.filter((invoice) => (filter === "all" || invoice.status === filter) && (!query || invoice.invoiceNumber.toLowerCase().includes(query) || invoice.customerName.toLowerCase().includes(query)));
  const visible = sortInvoices(filtered, sort);
  const filtersActive = filter !== "all" || search !== "" || sort !== "newest";
  const clearFilters = () => { setFilter("all"); setSearch(""); setSort("newest"); };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <View><Eyebrow>Invoices</Eyebrow><Text style={styles.title}>From draft to paid.</Text></View>
        {error ? <Notice error>{error}</Notice> : message ? <Notice>{message}</Notice> : null}
        <Button label="Create invoice" onPress={openNew} />
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Invoice # or customer" autoCapitalize="none" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(["all", "draft", "sent", "overdue", "paid"] as Filter[]).map((value) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value}</Text></Pressable>)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {SORTS.map((option) => <Pressable key={option.value} onPress={() => setSort(option.value)} style={[styles.filter, sort === option.value && styles.filterActive]}><Text style={[styles.filterText, sort === option.value && styles.filterTextActive]}>{option.label}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{filter === "all" ? "All invoices" : `${filter[0]?.toUpperCase()}${filter.slice(1)}`}</Text>
          <View style={styles.headActions}>{filtersActive ? <Pressable onPress={clearFilters}><Text style={styles.deleteLink}>Clear filters</Text></Pressable> : null}<Text style={styles.count}>{visible.length === invoices.length ? visible.length : `${visible.length} of ${invoices.length}`}</Text></View>
        </View>
        {visible.length ? visible.map((invoice) => <Pressable key={invoice.id} onPress={() => void openDetail(invoice.id)}><Card><View style={styles.invoiceTop}><View><Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text><Text style={styles.meta}>{invoice.customerName} · Due {shortDate(invoice.dueDate)}</Text></View><Text style={styles.amount}>{money(invoice.totalMinor, currency)}</Text></View><View style={[styles.status, styles[`status_${invoice.status}` as keyof typeof styles] as object]}><Text style={styles.statusText}>{invoice.status}</Text></View></Card></Pressable>) : <Card><Text style={styles.body}>No invoices in this view.</Text></Card>}
        {busy && !selected ? <Text style={styles.loading}>Loading invoice...</Text> : null}
      </ScrollView>

      <Modal visible={selected !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected ? <ScrollView contentContainerStyle={styles.modal}>
          <View style={styles.detailHead}><View><Eyebrow>{selected.status}</Eyebrow><Text style={styles.title}>{selected.invoiceNumber}</Text></View><Text style={styles.detailTotal}>{money(selected.totalMinor, selected.currency)}</Text></View>
          {error ? <Notice error>{error}</Notice> : message ? <Notice>{message}</Notice> : null}
          <Text style={styles.body}>For {selected.customerName} · Issued {shortDate(selected.issueDate)} · Due {shortDate(selected.dueDate)}</Text>
          <Card>{selected.items.map((item) => <View key={item.id || item.description} style={styles.detailItem}><View style={{ flex: 1 }}><Text style={styles.itemName}>{item.description}</Text><Text style={styles.meta}>{item.quantityMilli / 1000} × {money(item.unitPriceMinor, selected.currency)}</Text></View><Text style={styles.amount}>{money(item.amountMinor, selected.currency)}</Text></View>)}<View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.amount}>{money(selected.subtotalMinor, selected.currency)}</Text></View>{selected.taxMinor ? <View style={styles.totalRow}><Text style={styles.totalLabel}>Tax ({selected.taxRateBasisPoints / 100}%)</Text><Text style={styles.amount}>{money(selected.taxMinor, selected.currency)}</Text></View> : null}<View style={styles.grandTotal}><Text style={styles.grandLabel}>Total</Text><Text style={styles.grandAmount}>{money(selected.totalMinor, selected.currency)}</Text></View></Card>
          {selected.notes ? <Card><Eyebrow>Notes</Eyebrow><Text style={styles.body}>{selected.notes}</Text></Card> : null}
          {selected.status === "draft" ? <><Button label="Send invoice" disabled={busy} onPress={() => void send(selected)} /><Button label="Edit draft" secondary onPress={() => edit(selected)} /><Button label="Delete draft" danger onPress={() => remove(selected)} /></> : selected.status !== "paid" && selected.status !== "void" ? <><Button label="Send again" secondary disabled={busy} onPress={() => void send(selected)} /><Field label="Payment date (YYYY-MM-DD)" value={paidDate} onChangeText={setPaidDate} /><Button label="Mark paid" disabled={busy} onPress={() => confirmMarkPaid(selected)} /></> : <Notice>Paid {selected.paidDate ? shortDate(selected.paidDate) : ""}</Notice>}
          <Button label="Close" secondary onPress={() => { setSelected(null); setMessage(""); setError(""); }} />
        </ScrollView> : null}
      </Modal>

      <Modal visible={showEditor} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditor(false)}>
        <ScrollView contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled">
          <Eyebrow>{editingId ? "Edit draft" : "New invoice"}</Eyebrow><Text style={styles.title}>{editingId ? "Update the details." : "Create a clear invoice."}</Text>
          {error ? <Notice error>{error}</Notice> : null}
          <Text style={styles.label}>Customer</Text>
          {customers.length ? <View style={styles.customerList}>{customers.map((customer) => <Pressable key={customer.id} onPress={() => setDraft((value) => ({ ...value, customerId: customer.id }))} style={[styles.customer, draft.customerId === customer.id && styles.customerActive]}><Text style={styles.itemName}>{customer.name}</Text><Text style={styles.meta}>{customer.email || "No email added"}</Text></Pressable>)}</View> : <Notice>Add a customer from More → Manage customers before saving an invoice.</Notice>}
          <Field label="Issue date (YYYY-MM-DD)" value={draft.issueDate} onChangeText={(issueDate) => setDraft((value) => ({ ...value, issueDate }))} /><Field label="Due date (YYYY-MM-DD)" value={draft.dueDate} onChangeText={(dueDate) => setDraft((value) => ({ ...value, dueDate }))} />
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Line items</Text><Text style={styles.count}>{draft.items.length}</Text></View>
          {draft.items.map((item, index) => <Card key={item.key}><View style={styles.sectionHead}><Text style={styles.itemName}>Item {index + 1}</Text>{draft.items.length > 1 ? <Pressable onPress={() => setDraft((value) => ({ ...value, items: value.items.filter((candidate) => candidate.key !== item.key) }))}><Text style={styles.deleteLink}>Remove</Text></Pressable> : null}</View><Field label="Description" value={item.description} onChangeText={(description) => updateItem(item.key, { description })} placeholder="Consulting services" /><View style={styles.fieldPair}><View style={{ flex: 1 }}><Field label="Quantity" value={item.quantity} keyboardType="decimal-pad" onChangeText={(quantity) => updateItem(item.key, { quantity })} /></View><View style={{ flex: 1 }}><Field label="Unit price" value={item.unitPrice} keyboardType="decimal-pad" onChangeText={(unitPrice) => updateItem(item.key, { unitPrice })} placeholder="0.00" /></View></View><Text style={styles.lineTotal}>{money(Math.round((Number(item.quantity) || 0) * (parseMoney(item.unitPrice) || 0)), currency)}</Text></Card>)}
          <Button label="Add line item" secondary onPress={() => setDraft((value) => ({ ...value, items: [...value.items, blankItem()] }))} />
          <Field label="Tax rate (%)" value={draft.taxRate} keyboardType="decimal-pad" onChangeText={(taxRate) => setDraft((value) => ({ ...value, taxRate }))} /><Text style={styles.label}>Notes</Text><TextInput multiline value={draft.notes} onChangeText={(notes) => setDraft((value) => ({ ...value, notes }))} style={styles.notes} placeholder="Payment terms or a short thank-you" placeholderTextColor="#8B8D87" />
          <Card dark><Eyebrow light>Invoice total</Eyebrow><Text style={styles.editorTotal}>{money(total, currency)}</Text><Text style={styles.darkBody}>Subtotal {money(subtotal, currency)} · Tax {draft.taxRate || "0"}%</Text></Card>
          <Button label={busy ? "Saving..." : editingId ? "Save changes" : "Save draft"} disabled={busy || !draft.customerId || total <= 0} onPress={save} /><Button label="Cancel" secondary onPress={() => setShowEditor(false)} />
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 120, gap: 18 }, modal: { padding: 24, paddingTop: 60, paddingBottom: 60, gap: 16, backgroundColor: colors.paper, flexGrow: 1 }, title: { fontFamily: "Newsreader_700Bold", fontSize: 38, lineHeight: 42, color: colors.ink, marginTop: 5 },
  filters: { gap: 8 }, filter: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.card }, filterActive: { backgroundColor: colors.acid, borderColor: colors.ink }, filterText: { fontFamily: "SpaceMono_700Bold", color: colors.muted, fontSize: 10, textTransform: "uppercase" }, filterTextActive: { color: colors.ink },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, headActions: { flexDirection: "row", alignItems: "center", gap: 12 }, sectionTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 20, color: colors.ink }, count: { fontFamily: "SpaceMono_700Bold", color: colors.teal }, invoiceTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, invoiceNumber: { fontFamily: "Manrope_800ExtraBold", fontSize: 17 }, meta: { fontFamily: "Manrope_500Medium", color: colors.muted, fontSize: 12, marginTop: 3 }, amount: { fontFamily: "SpaceMono_700Bold", color: colors.ink },
  status: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.line }, status_draft: { backgroundColor: "#E5E2DA" }, status_sent: { backgroundColor: "#DDEBE6" }, status_overdue: { backgroundColor: "#FFD8C9" }, status_paid: { backgroundColor: colors.acid }, statusText: { fontFamily: "SpaceMono_700Bold", fontSize: 9, textTransform: "uppercase" }, body: { fontFamily: "Manrope_500Medium", color: colors.muted, lineHeight: 22 }, loading: { textAlign: "center", fontFamily: "Manrope_600SemiBold", color: colors.muted },
  detailHead: { gap: 8 }, detailTotal: { fontFamily: "SpaceMono_700Bold", color: colors.teal, fontSize: 28 }, detailItem: { flexDirection: "row", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line }, itemName: { fontFamily: "Manrope_700Bold", color: colors.ink }, totalRow: { flexDirection: "row", justifyContent: "space-between" }, totalLabel: { fontFamily: "Manrope_600SemiBold", color: colors.muted }, grandTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 13, borderTopWidth: 2, borderColor: colors.ink }, grandLabel: { fontFamily: "Manrope_800ExtraBold", fontSize: 18 }, grandAmount: { fontFamily: "SpaceMono_700Bold", fontSize: 19 },
  label: { fontFamily: "Manrope_700Bold", fontSize: 13, color: colors.ink }, customerList: { gap: 8 }, customer: { borderWidth: 1, borderColor: colors.line, padding: 12, backgroundColor: colors.card }, customerActive: { borderColor: colors.ink, backgroundColor: "#F4F6DA" }, fieldPair: { flexDirection: "row", gap: 10 }, deleteLink: { fontFamily: "Manrope_700Bold", color: colors.danger }, lineTotal: { textAlign: "right", fontFamily: "SpaceMono_700Bold", fontSize: 18, color: colors.teal }, notes: { minHeight: 110, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.white, padding: 13, textAlignVertical: "top", fontFamily: "Manrope_500Medium" }, editorTotal: { fontFamily: "SpaceMono_700Bold", fontSize: 32, color: colors.white }, darkBody: { fontFamily: "Manrope_500Medium", color: "#C8D2CD" },
});
