import { Ionicons } from "@expo/vector-icons";
import { useFonts as useManrope, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { useFonts as useNewsreader, Newsreader_700Bold } from "@expo-google-fonts/newsreader";
import { useFonts as useMono, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ApiError, api } from "./src/api";
import { AuthScreen } from "./src/AuthScreen";
import { Loading, Notice } from "./src/components";
import { HomeScreen } from "./src/HomeScreen";
import { InvoicesScreen } from "./src/InvoicesScreen";
import { MoreScreen } from "./src/MoreScreen";
import { PlanScreen, type PlanPrefill } from "./src/PlanScreen";
import { ReviewScreen } from "./src/ReviewScreen";
import { colors } from "./src/theme";
import type { Financials } from "./src/types";
import { errorMessage } from "./src/utils";

type Tab = "home" | "plan" | "invoices" | "review" | "more";
const tabs: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [{ id: "home", label: "Home", icon: "home-outline" }, { id: "plan", label: "Plan", icon: "calendar-outline" }, { id: "invoices", label: "Invoices", icon: "document-text-outline" }, { id: "review", label: "Review", icon: "checkmark-circle-outline" }, { id: "more", label: "More", icon: "settings-outline" }];

export default function App() {
  const [manrope] = useManrope({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  const [newsreader] = useNewsreader({ Newsreader_700Bold });
  const [mono] = useMono({ SpaceMono_700Bold });
  const [data, setData] = useState<Financials | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [scenario, setScenario] = useState(false);
  const [planPrefill, setPlanPrefill] = useState<PlanPrefill | null>(null);

  const load = async () => {
    try { const result = await api.financials(); setData(result); setAuthenticated(true); setError(""); }
    catch (caught) { if (caught instanceof ApiError && caught.status === 401) { setAuthenticated(false); setData(null); } else setError(errorMessage(caught)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  if (!manrope || !newsreader || !mono || loading || authenticated === null) return <SafeAreaProvider><Loading /></SafeAreaProvider>;
  if (!authenticated) return <SafeAreaProvider><StatusBar style="dark" /><AuthScreen onAuthenticated={load} /></SafeAreaProvider>;
  if (!data) return <SafeAreaProvider><SafeAreaView style={styles.center}><Notice error>{error || "Unable to load your cash plan."}</Notice><Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable></SafeAreaView></SafeAreaProvider>;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={styles.root}>
        <View style={styles.header}><Image source={require("./assets/icon.png")} style={styles.brandMark} /><Text style={styles.brand}>finvayo</Text></View>
        <View style={styles.screen}>{error ? <Notice error>{error}</Notice> : null}{tab === "home" ? <HomeScreen data={data} refresh={load} goToPlan={() => setTab("plan")} goToReview={() => setTab("review")} goToScenario={() => { setTab("more"); setScenario(true); }} /> : tab === "plan" ? <PlanScreen data={data} refresh={load} prefill={planPrefill} consumePrefill={() => setPlanPrefill(null)} /> : tab === "invoices" ? <InvoicesScreen currency={data.currency} refreshFinancials={load} /> : tab === "review" ? <ReviewScreen data={data} refresh={load} /> : <MoreScreen data={data} refresh={load} onLogout={() => setAuthenticated(false)} openScenario={scenario} closeScenario={() => setScenario(false)} onAddToPlan={(amountMinor, date) => { setPlanPrefill({ amountMinor, date }); setTab("plan"); }} />}</View>
        <SafeAreaView edges={["bottom"]} style={styles.tabSafe}><View style={styles.tabs}>{tabs.map((item) => { const active = tab === item.id; return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={item.id} onPress={() => setTab(item.id)} style={styles.tab}><Ionicons name={item.icon} size={22} color={active ? colors.acid : "#AEB7B2"} /><Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text></Pressable>; })}</View></SafeAreaView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.paper }, screen: { flex: 1 }, header: { minHeight: 58, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 8 }, brandMark: { width: 28, height: 28, borderRadius: 6 }, brand: { fontFamily: "Manrope_800ExtraBold", fontSize: 19, flex: 1 }, tabSafe: { backgroundColor: colors.tealDark }, tabs: { minHeight: 68, flexDirection: "row", borderTopWidth: 1, borderColor: "#32443D" }, tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }, tabText: { fontFamily: "Manrope_600SemiBold", color: "#AEB7B2", fontSize: 11 }, tabTextActive: { color: colors.acid }, center: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.paper }, retry: { fontFamily: "Manrope_700Bold", color: colors.teal } });
