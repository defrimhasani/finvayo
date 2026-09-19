import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./api";
import { Button, Card, Choice, Eyebrow, Notice } from "./components";
import { colors } from "./theme";
import type { Financials, Workflows } from "./types";
import { errorMessage, money, shortDate } from "./utils";

const steps = [{ id: "cash", label: "Current cash is confirmed" }, { id: "income", label: "Received payments are updated" }, { id: "expenses", label: "Paid obligations are updated" }, { id: "overdue", label: "Overdue income is reviewed" }, { id: "outlook", label: "The next 30 days look right" }] as const;

export function ReviewScreen({ data, refresh }: { data: Financials; refresh: () => Promise<void> }) {
  const [workflow, setWorkflow] = useState<Workflows | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [tone, setTone] = useState<"friendly" | "direct" | "final">("friendly");
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const load = async () => { try { setWorkflow(await api.workflows()); } catch (caught) { setError(errorMessage(caught)); } };
  useEffect(() => { void load(); }, []);
  const overdue = data.entries.filter((entry) => entry.direction === "inflow" && entry.status === "overdue");
  const complete = async () => { setError(""); try { await api.post("/api/weekly-reviews", { completed: checked }); setChecked([]); setStatus("Weekly review complete. Your plan is ready for the week ahead."); await load(); } catch (caught) { setError(errorMessage(caught)); } };
  const preview = async () => { if (!selected) return; setError(""); try { const result = await api.post<{ message: string }>("/api/follow-ups/preview", { entryId: selected, tone }); setMessage(result.message); } catch (caught) { setError(errorMessage(caught)); } };
  const record = async () => { if (!selected || !message) return; setError(""); try { await Clipboard.setStringAsync(message); await api.post("/api/follow-ups", { entryId: selected, tone, message }); setStatus("Copied. Follow-up recorded in Finvayo."); await load(); } catch (caught) { setError(errorMessage(caught)); } };
  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={async () => { await refresh(); await load(); }} />}>
      <View><Eyebrow>Weekly rhythm</Eyebrow><Text style={styles.title}>Five minutes to a clearer week.</Text></View>
      {workflow?.lastReview ? <Notice>Last reviewed {new Date(workflow.lastReview.completedAt * 1000).toLocaleDateString()}.</Notice> : <Notice>Your first completed review will appear here.</Notice>}
      {error ? <Notice error>{error}</Notice> : status ? <Notice>{status}</Notice> : null}
      <Card>
        <Eyebrow>Review checklist</Eyebrow><Text style={styles.cardTitle}>Make every input current</Text>
        {steps.map((step, index) => { const active = checked.includes(step.id); return <Pressable key={step.id} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => setChecked((value) => active ? value.filter((item) => item !== step.id) : [...value, step.id])} style={styles.step}><View style={[styles.check, active && styles.checked]}>{active ? <Text style={styles.tick}>✓</Text> : <Text style={styles.number}>{index + 1}</Text>}</View><Text style={styles.stepText}>{step.label}</Text></Pressable>; })}
        <Button label="Complete weekly review" disabled={checked.length !== steps.length} onPress={complete} />
      </Card>
      <Card>
        <Eyebrow>Late payment</Eyebrow><Text style={styles.cardTitle}>Prepare a follow-up</Text><Text style={styles.body}>Finvayo prepares the words. You decide how and when to send them.</Text>
        {overdue.length ? <>{overdue.map((entry) => <Pressable key={entry.id} onPress={() => { setSelected(entry.id); setMessage(""); }} style={[styles.overdue, selected === entry.id && styles.overdueSelected]}><View style={{ flex: 1 }}><Text style={styles.entryName}>{entry.partyName || entry.clientName || entry.name}</Text><Text style={styles.meta}>Due {shortDate(entry.scheduledDate)}</Text></View><Text style={styles.amount}>{money(entry.amountMinor, data.currency)}</Text></Pressable>)}<Choice value={tone} options={[{ value: "friendly", label: "Friendly" }, { value: "direct", label: "Direct" }, { value: "final", label: "Final" }]} onChange={setTone} /><Button label="Draft message" secondary disabled={!selected} onPress={preview} />{message ? <><TextInput multiline value={message} onChangeText={setMessage} style={styles.message} /><Button label="Copy and mark followed up" onPress={record} /></> : null}</> : <Text style={styles.body}>No overdue income needs attention.</Text>}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 120, gap: 18 }, title: { fontFamily: "Newsreader_700Bold", fontSize: 38, lineHeight: 42, color: colors.ink, marginTop: 5 }, cardTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 21 }, body: { fontFamily: "Manrope_500Medium", color: colors.muted, lineHeight: 22 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }, check: { width: 34, height: 34, borderWidth: 1, borderColor: colors.ink, alignItems: "center", justifyContent: "center" }, checked: { backgroundColor: colors.acid }, tick: { fontWeight: "800", fontSize: 18 }, number: { fontFamily: "SpaceMono_700Bold", color: colors.muted }, stepText: { flex: 1, fontFamily: "Manrope_600SemiBold", color: colors.ink },
  overdue: { borderWidth: 1, borderColor: colors.line, padding: 12, flexDirection: "row", alignItems: "center" }, overdueSelected: { borderColor: colors.ink, backgroundColor: "#F4F6DA" }, entryName: { fontFamily: "Manrope_700Bold" }, meta: { fontFamily: "Manrope_500Medium", color: colors.muted, fontSize: 12 }, amount: { fontFamily: "SpaceMono_700Bold" }, message: { borderWidth: 1, borderColor: colors.ink, minHeight: 150, padding: 13, backgroundColor: colors.white, textAlignVertical: "top", fontFamily: "Manrope_500Medium", lineHeight: 21 },
});
