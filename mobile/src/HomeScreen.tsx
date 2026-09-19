import { Ionicons } from "@expo/vector-icons";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Eyebrow, Notice } from "./components";
import { colors } from "./theme";
import type { Financials } from "./types";
import { money, shortDate } from "./utils";

export function HomeScreen({ data, refresh, goToPlan, goToReview, goToScenario }: { data: Financials; refresh: () => Promise<void>; goToPlan: () => void; goToReview: () => void; goToScenario: () => void }) {
  const overview = data.overview;
  if (!overview) {
    return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}><Text style={styles.title}>Start with what is real.</Text><Text style={styles.lede}>Confirm today's cash balance, then add the money you expect in and out.</Text><Card><Eyebrow>First step</Eyebrow><Text style={styles.cardTitle}>Confirm current cash</Text><Text style={styles.body}>Your confirmed balance anchors every 90-day projection.</Text><Button label="Set up my plan" onPress={goToPlan} /></Card></ScrollView>;
  }
  const riskLabel = overview.risk === "at_risk" ? "At risk" : overview.risk === "caution" ? "Caution" : "On track";
  const upcoming = overview.events.filter((event) => event.date <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)).slice(0, 5);
  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
      <View><Eyebrow>Your outlook</Eyebrow><Text style={styles.title}>Cash, without the guesswork.</Text></View>
      {overview.provisional ? <Notice>Cash changed after your last confirmation. Refresh your balance before relying on this estimate.</Notice> : null}
      <Card dark>
        <View style={styles.metricTop}><Eyebrow light>Safe to spend now</Eyebrow><View style={[styles.riskBadge, overview.risk === "normal" ? styles.normal : overview.risk === "caution" ? styles.caution : styles.risk]}><Text style={styles.riskText}>{riskLabel}</Text></View></View>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroAmount}>{money(overview.safeToSpendMinor, data.currency)}</Text>
        <Text style={styles.darkBody}>Planning estimate based on the cash and commitments entered.</Text>
        <View style={styles.metrics}>
          <View><Text style={styles.metricLabel}>Current cash</Text><Text style={styles.metricValue}>{money(overview.currentCashMinor, data.currency)}</Text></View>
          <View><Text style={styles.metricLabel}>Protected</Text><Text style={styles.metricValue}>{money(overview.protectedMinor, data.currency)}</Text></View>
        </View>
      </Card>
      <Card>
        <Eyebrow>Next move</Eyebrow>
        <Text style={styles.cardTitle}>{overview.recommendation.title}</Text>
        {overview.recommendation.amountMinor !== null ? <Text style={styles.actionAmount}>{money(overview.recommendation.amountMinor, data.currency)}</Text> : null}
        <Text style={styles.body}>{overview.recommendation.detail}</Text>
        <Button label="Open cash plan" onPress={goToPlan} />
      </Card>
      <Card>
        <View style={styles.sectionHead}><View><Eyebrow>90-day outlook</Eyebrow><Text style={styles.cardTitle}>Your lowest point</Text></View><Ionicons name="trending-down-outline" size={28} color={colors.teal} /></View>
        <Text style={styles.largeAmount}>{money(overview.lowestBalanceMinor, data.currency)}</Text>
        <Text style={styles.body}>The tightest projected point is around {shortDate(overview.limitingDate)}. Your protected level is {money(overview.protectedMinor, data.currency)}.</Text>
        {overview.firstNegativeDate ? <Notice error>Projected cash falls below zero on {shortDate(overview.firstNegativeDate)}.</Notice> : overview.firstBreachDate ? <Notice>Your protected level is crossed on {shortDate(overview.firstBreachDate)}.</Notice> : <Notice>Your plan stays above the protected level.</Notice>}
        <Button label="Check a purchase" secondary onPress={goToScenario} />
      </Card>
      <Card>
        <View style={styles.sectionHead}><View><Eyebrow>Next 14 days</Eyebrow><Text style={styles.cardTitle}>What is moving</Text></View><Text style={styles.count}>{upcoming.length}</Text></View>
        {upcoming.length ? upcoming.map((event) => <View key={`${event.id}-${event.date}`} style={styles.event}><View style={[styles.eventMark, event.direction === "inflow" ? styles.inflow : styles.outflow]} /><View style={styles.eventCopy}><Text style={styles.eventName}>{event.name}</Text><Text style={styles.eventMeta}>{shortDate(event.date)} · {event.status}</Text></View><Text style={styles.eventAmount}>{event.direction === "outflow" ? "−" : "+"}{money(event.amountMinor, data.currency)}</Text></View>) : <Text style={styles.body}>No planned movements in the next two weeks.</Text>}
      </Card>
      <Button label="Start weekly review" onPress={goToReview} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 120, gap: 18 },
  title: { fontFamily: "Newsreader_700Bold", fontSize: 38, lineHeight: 42, color: colors.ink, marginTop: 5 },
  lede: { fontFamily: "Manrope_500Medium", fontSize: 16, lineHeight: 24, color: colors.muted },
  cardTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 21, lineHeight: 26, color: colors.ink },
  body: { fontFamily: "Manrope_500Medium", color: colors.muted, lineHeight: 22 },
  darkBody: { fontFamily: "Manrope_500Medium", color: "#C8D2CD", lineHeight: 21 },
  metricTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 6 }, normal: { backgroundColor: colors.acid }, caution: { backgroundColor: "#F3B955" }, risk: { backgroundColor: colors.orange },
  riskText: { fontFamily: "SpaceMono_700Bold", fontSize: 10, textTransform: "uppercase", color: colors.ink },
  heroAmount: { fontFamily: "SpaceMono_700Bold", fontSize: 43, color: colors.white, letterSpacing: -2 },
  metrics: { borderTopWidth: 1, borderColor: "#3C514A", paddingTop: 14, flexDirection: "row", justifyContent: "space-between" },
  metricLabel: { color: "#9FAEA7", fontFamily: "Manrope_600SemiBold", fontSize: 12 },
  metricValue: { color: colors.white, fontFamily: "SpaceMono_700Bold", marginTop: 5 },
  actionAmount: { fontFamily: "SpaceMono_700Bold", color: colors.orange, fontSize: 24 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  largeAmount: { fontFamily: "SpaceMono_700Bold", fontSize: 31, color: colors.teal },
  count: { fontFamily: "SpaceMono_700Bold", fontSize: 24, color: colors.teal },
  event: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  eventMark: { width: 8, height: 35 }, inflow: { backgroundColor: colors.teal }, outflow: { backgroundColor: colors.orange },
  eventCopy: { flex: 1 }, eventName: { fontFamily: "Manrope_700Bold", color: colors.ink }, eventMeta: { fontFamily: "Manrope_500Medium", color: colors.muted, fontSize: 12, marginTop: 2 },
  eventAmount: { fontFamily: "SpaceMono_700Bold", color: colors.ink, fontSize: 13 },
});
