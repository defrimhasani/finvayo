import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./api";
import { Button, Card, Choice, Eyebrow, Field, Notice } from "./components";
import { colors } from "./theme";
import type { Party } from "./types";
import { errorMessage } from "./utils";

type PartyRole = Party["role"];
type Draft = { name: string; role: PartyRole; email: string; phone: string; notes: string };

const blankDraft = (): Draft => ({ name: "", role: "customer", email: "", phone: "", notes: "" });

const roleLabel = (role: PartyRole) => (role === "both" ? "Customer & supplier" : role === "supplier" ? "Supplier" : "Customer");

export function CustomersScreen({ onClose }: { onClose: () => void }) {
  const [parties, setParties] = useState<Party[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setParties((await api.parties()).parties);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const openNew = () => { setDraft(blankDraft()); setEditingId(null); setError(""); setMessage(""); setShowEditor(true); };
  const edit = (party: Party) => {
    setDraft({ name: party.name, role: party.role, email: party.email || "", phone: party.phone || "", notes: party.notes || "" });
    setEditingId(party.id); setError(""); setMessage(""); setShowEditor(true);
  };

  const save = async () => {
    setBusy(true); setError("");
    const body = { name: draft.name, role: draft.role, email: draft.email || null, phone: draft.phone || null, notes: draft.notes || null };
    try {
      if (editingId) await api.patch(`/api/parties/${editingId}`, body);
      else await api.post("/api/parties", body);
      setShowEditor(false);
      await load();
      setMessage(editingId ? "Customer updated." : "Customer added.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = (party: Party) => Alert.alert("Delete customer?", `${party.name} will be removed from your directory.`, [
    { text: "Keep", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => {
      try {
        await api.delete(`/api/parties/${party.id}`);
        await load();
        setMessage("Customer deleted.");
      } catch (caught) {
        setError(errorMessage(caught));
      }
    } },
  ]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View><Eyebrow>Directory</Eyebrow><Text style={styles.title}>Customers & suppliers.</Text></View>
      {error ? <Notice error>{error}</Notice> : message ? <Notice>{message}</Notice> : null}

      {showEditor ? (
        <Card>
          <Eyebrow>{editingId ? "Edit customer" : "New customer"}</Eyebrow>
          <Field label="Name" value={draft.name} onChangeText={(name) => setDraft((value) => ({ ...value, name }))} placeholder="Acme Co." />
          <Text style={styles.label}>Role</Text>
          <Choice value={draft.role} options={[{ value: "customer", label: "Customer" }, { value: "supplier", label: "Supplier" }, { value: "both", label: "Both" }]} onChange={(role) => setDraft((value) => ({ ...value, role }))} />
          <Field label="Email (optional)" value={draft.email} onChangeText={(email) => setDraft((value) => ({ ...value, email }))} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone (optional)" value={draft.phone} onChangeText={(phone) => setDraft((value) => ({ ...value, phone }))} keyboardType="phone-pad" />
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput multiline value={draft.notes} onChangeText={(notes) => setDraft((value) => ({ ...value, notes }))} style={styles.notes} placeholder="Payment terms, preferences, etc." placeholderTextColor="#8B8D87" />
          <Button label={busy ? "Saving..." : editingId ? "Save changes" : "Add customer"} disabled={busy || !draft.name} onPress={save} />
          <Button label="Cancel" secondary onPress={() => setShowEditor(false)} />
        </Card>
      ) : (
        <Button label="Add customer" onPress={openNew} />
      )}

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Registered</Text><Text style={styles.count}>{parties.length}</Text></View>
      {loading ? <Text style={styles.body}>Loading directory...</Text> : parties.length ? parties.map((party) => (
        <Card key={party.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{party.name}</Text>
              <Text style={styles.meta}>{[party.email, party.phone].filter(Boolean).join(" · ") || "No contact details"}</Text>
            </View>
            <View style={styles.badge}><Text style={styles.badgeText}>{roleLabel(party.role)}</Text></View>
          </View>
          <View style={styles.actions}>
            <Button label="Edit" secondary onPress={() => edit(party)} />
            <Button label="Delete" danger onPress={() => remove(party)} />
          </View>
        </Card>
      )) : <Card><Text style={styles.body}>No customers or suppliers registered yet.</Text></Card>}

      <Button label="Close" secondary onPress={onClose} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 60, paddingBottom: 60, gap: 16, backgroundColor: colors.paper, flexGrow: 1 },
  title: { fontFamily: "Newsreader_700Bold", fontSize: 38, lineHeight: 42, color: colors.ink, marginTop: 5 },
  label: { fontFamily: "Manrope_700Bold", fontSize: 13, color: colors.ink },
  notes: { minHeight: 90, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.white, padding: 13, textAlignVertical: "top", fontFamily: "Manrope_500Medium" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 20, color: colors.ink },
  count: { fontFamily: "SpaceMono_700Bold", color: colors.teal },
  body: { fontFamily: "Manrope_500Medium", color: colors.muted, lineHeight: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  itemName: { fontFamily: "Manrope_700Bold", fontSize: 16, color: colors.ink },
  meta: { fontFamily: "Manrope_500Medium", color: colors.muted, fontSize: 12, marginTop: 3 },
  badge: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.paper },
  badgeText: { fontFamily: "SpaceMono_700Bold", fontSize: 9, textTransform: "uppercase", color: colors.muted },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
