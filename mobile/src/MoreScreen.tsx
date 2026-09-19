import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, API_URL, authApi } from "./api";
import { Button, Card, Choice, Eyebrow, Field, Notice } from "./components";
import { CustomersScreen } from "./CustomersScreen";
import { colors } from "./theme";
import type { Financials, ScenarioResult, Settings } from "./types";
import { errorMessage, money, parseMoney, shortDate, today } from "./utils";

const CURRENCIES: Array<[Settings["currency"], string]> = [["USD", "USD - US dollar"], ["EUR", "EUR - Euro"], ["GBP", "GBP - British pound"]];
const TIMEZONE_GROUPS: Array<{ label: string; zones: Array<[string, string]> }> = [
  { label: "Universal", zones: [["UTC", "UTC"]] },
  { label: "Americas", zones: [["America/New_York", "Eastern Time (US & Canada)"], ["America/Chicago", "Central Time (US & Canada)"], ["America/Denver", "Mountain Time (US & Canada)"], ["America/Los_Angeles", "Pacific Time (US & Canada)"], ["America/Toronto", "Toronto"]] },
  { label: "Europe", zones: [["Europe/London", "London"], ["Europe/Paris", "Paris"], ["Europe/Berlin", "Berlin"], ["Europe/Zurich", "Zurich"], ["Europe/Tirane", "Tirana"]] },
  { label: "Asia & Pacific", zones: [["Asia/Dubai", "Dubai"], ["Asia/Kolkata", "India"], ["Asia/Singapore", "Singapore"], ["Asia/Tokyo", "Tokyo"], ["Australia/Sydney", "Sydney"]] },
];
const timezoneLabel = (value: string) => TIMEZONE_GROUPS.flatMap((group) => group.zones).find(([zoneValue]) => zoneValue === value)?.[1] || value;
const currencyLabel = (value: string) => CURRENCIES.find(([currencyValue]) => currencyValue === value)?.[1] || value;

export function MoreScreen({ data, refresh, onLogout, openScenario = false, closeScenario, onAddToPlan }: { data: Financials; refresh: () => Promise<void>; onLogout: () => void; openScenario?: boolean; closeScenario: () => void; onAddToPlan: (amountMinor: number, date: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [buffer, setBuffer] = useState(""); const [reserve, setReserve] = useState(""); const [rate, setRate] = useState(""); const [delay, setDelay] = useState("");
  const [billing, setBilling] = useState<{ status: string; trialEndsAt: number } | null>(null);
  const [amount, setAmount] = useState(""); const [date, setDate] = useState(today()); const [result, setResult] = useState<ScenarioResult | null>(null);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [showCustomers, setShowCustomers] = useState(false);
  const [showTimezone, setShowTimezone] = useState(false);
  const [showCurrency, setShowCurrency] = useState(false);
  const load = async () => { try { const [settingsResult, billingResult] = await Promise.all([api.settings(), api.billing()]); const next = settingsResult.settings; setSettings(next); if (next) { setBuffer(String(next.minimumBufferMinor / 100)); setReserve(String(next.taxReserveMinor / 100)); setRate(String(next.taxRateBasisPoints / 100)); setDelay(String(next.paymentDelayDays)); } setBilling({ status: billingResult.subscription.status, trialEndsAt: billingResult.trialEndsAt }); } catch (caught) { setError(errorMessage(caught)); } };
  useEffect(() => { void load(); }, []);
  const scenario = async () => { setError(""); try { setResult(await api.scenario({ amountMinor: parseMoney(amount), date })); } catch (caught) { setError(errorMessage(caught)); } };
  const saveSettings = async () => { if (!settings) return; setSaving(true); setError(""); try { await api.patch("/api/settings", { ...settings, minimumBufferMinor: parseMoney(buffer), taxReserveMinor: parseMoney(reserve), taxRateBasisPoints: Math.round(Number(rate) * 100), paymentDelayDays: Number(delay) }); setMessage("Workspace settings saved."); await refresh(); await load(); } catch (caught) { setError(errorMessage(caught)); } finally { setSaving(false); } };
  const logout = async () => { try { await authApi.logout(); } finally { onLogout(); } };
  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View><Eyebrow>Workspace</Eyebrow><Text style={styles.title}>The controls behind your plan.</Text></View>
        {error ? <Notice error>{error}</Notice> : message ? <Notice>{message}</Notice> : null}
        <Card dark><Eyebrow light>Account</Eyebrow><Text style={styles.account}>{settings?.email || "Finvayo workspace"}</Text><Text style={styles.darkBody}>{billing ? `${billing.status.replace("_", " ")} · ${billing.status === "trialing" ? `trial ends ${new Date(billing.trialEndsAt * 1000).toLocaleDateString()}` : "billing managed securely by Stripe"}` : "Loading billing status..."}</Text><Button label="Manage billing on finvayo.com" onPress={() => Linking.openURL(`${API_URL}/app/settings`)} /></Card>
        {settings ? <Card><Eyebrow>Planning assumptions</Eyebrow><Field label="Workspace name" value={settings.name} onChangeText={(name) => setSettings({ ...settings, name })} /><Text style={styles.label}>Currency</Text><Pressable onPress={() => { if (!settings.currencyLocked) setShowCurrency(true); }} style={[styles.selectRow, Boolean(settings.currencyLocked) && styles.selectRowDisabled]}><Text style={styles.selectValue}>{currencyLabel(settings.currency)}</Text><Text style={styles.selectChange}>{settings.currencyLocked ? "Locked" : "Change"}</Text></Pressable><Text style={styles.help}>{settings.currencyLocked ? "Locked because this workspace has financial records." : "Currency locks after your first financial record."}</Text><Text style={styles.label}>Timezone</Text><Pressable onPress={() => setShowTimezone(true)} style={styles.selectRow}><Text style={styles.selectValue}>{timezoneLabel(settings.timezone)}</Text><Text style={styles.selectChange}>Change</Text></Pressable><Field label="Minimum cash buffer" value={buffer} keyboardType="decimal-pad" onChangeText={setBuffer} /><Text style={styles.label}>Tax reserve method</Text><Choice value={settings.taxReserveMode} options={[{ value: "fixed", label: "Fixed" }, { value: "percentage", label: "% of income" }]} onChange={(taxReserveMode) => setSettings({ ...settings, taxReserveMode })} /><Field label="Tax already reserved" value={reserve} keyboardType="decimal-pad" onChangeText={setReserve} />{settings.taxReserveMode === "percentage" ? <Field label="Future income tax rate (%)" value={rate} keyboardType="decimal-pad" onChangeText={setRate} /> : null}<Field label="Typical payment delay (days)" value={delay} keyboardType="number-pad" onChangeText={setDelay} /><Button label={saving ? "Saving..." : "Save assumptions"} disabled={saving} onPress={saveSettings} /></Card> : null}
        <Card><Eyebrow>Directory</Eyebrow><Text style={styles.body}>View, add, edit, and remove the customers and suppliers you transact with.</Text><Button label="Manage customers" secondary onPress={() => setShowCustomers(true)} /></Card>
        <Card><Eyebrow>Data & access</Eyebrow><Text style={styles.body}>Export, reset, and account deletion remain available from the secure web settings page.</Text><Button label="Open data controls" secondary onPress={() => Linking.openURL(`${API_URL}/app/settings`)} /><Button label="Sign out" danger onPress={logout} /></Card>
      </ScrollView>
      <Modal visible={showCustomers} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCustomers(false)}><CustomersScreen onClose={() => setShowCustomers(false)} /></Modal>
      <Modal visible={showCurrency} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCurrency(false)}>
        <ScrollView contentContainerStyle={styles.modal}>
          <Eyebrow>Workspace</Eyebrow><Text style={styles.title}>Choose a currency.</Text>
          {settings ? <Choice value={settings.currency} options={CURRENCIES.map(([value, label]) => ({ value, label }))} onChange={(currency) => setSettings({ ...settings, currency })} /> : null}
          <Button label="Done" onPress={() => setShowCurrency(false)} />
        </ScrollView>
      </Modal>
      <Modal visible={showTimezone} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTimezone(false)}>
        <ScrollView contentContainerStyle={styles.modal}>
          <Eyebrow>Workspace</Eyebrow><Text style={styles.title}>Choose a timezone.</Text>
          {settings ? TIMEZONE_GROUPS.map((group) => <View key={group.label}><Text style={styles.groupLabel}>{group.label}</Text><Choice value={settings.timezone} options={group.zones.map(([value, label]) => ({ value, label }))} onChange={(timezone) => setSettings({ ...settings, timezone })} /></View>) : null}
          <Button label="Done" onPress={() => setShowTimezone(false)} />
        </ScrollView>
      </Modal>
      <Modal visible={openScenario} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeScenario}><ScrollView contentContainerStyle={styles.modal}><Eyebrow>What-if check</Eyebrow><Text style={styles.title}>Can the plan carry this?</Text><Text style={styles.body}>This check is temporary and never changes your live plan.</Text>{error ? <Notice error>{error}</Notice> : null}<Field label="Purchase amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" /><Field label="Payment date (YYYY-MM-DD)" value={date} onChangeText={setDate} /><Button label="Run scenario" disabled={!amount} onPress={scenario} />{result ? <Card dark><Eyebrow light>{result.risk === "normal" ? "Plan stays on track" : result.risk === "caution" ? "Use caution" : "Plan is at risk"}</Eyebrow><Text style={styles.resultAmount}>{money(result.lowestBalanceMinor, data.currency)}</Text><Text style={styles.darkBody}>New lowest projected cash. Safe to spend changes by {money(result.safeToSpendChangeMinor, data.currency)}.</Text>{result.crossesProtectedLevel ? <Notice error>This purchase crosses your protected cash level.</Notice> : <Notice>Your protected level remains intact.</Notice>}<Button label="Add to plan" secondary onPress={() => { onAddToPlan(result.amountMinor, result.date); setResult(null); closeScenario(); }} /></Card> : null}<Button label="Close" secondary onPress={() => { setResult(null); closeScenario(); }} /></ScrollView></Modal>
    </>
  );
}

const styles = StyleSheet.create({ content: { padding: 20, paddingBottom: 120, gap: 18 }, modal: { padding: 24, paddingTop: 60, gap: 16, backgroundColor: colors.paper, flexGrow: 1 }, title: { fontFamily: "Newsreader_700Bold", fontSize: 38, lineHeight: 42, color: colors.ink, marginTop: 5 }, account: { fontFamily: "Manrope_800ExtraBold", color: colors.white, fontSize: 22 }, darkBody: { fontFamily: "Manrope_500Medium", color: "#C8D2CD", lineHeight: 21 }, body: { fontFamily: "Manrope_500Medium", color: colors.muted, lineHeight: 22 }, label: { fontFamily: "Manrope_700Bold", fontSize: 13 }, groupLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: colors.teal, marginTop: 6, marginBottom: 2 }, help: { fontFamily: "Manrope_500Medium", color: colors.muted, fontSize: 12 },
  selectRow: { minHeight: 50, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.white, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, selectRowDisabled: { borderColor: colors.line, backgroundColor: colors.paper }, selectValue: { fontFamily: "Manrope_600SemiBold", fontSize: 15, color: colors.ink }, selectChange: { fontFamily: "Manrope_700Bold", fontSize: 13, color: colors.teal }, resultAmount: { fontFamily: "SpaceMono_700Bold", fontSize: 32, color: colors.white } });
