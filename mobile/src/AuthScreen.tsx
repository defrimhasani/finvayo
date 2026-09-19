import { useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { authApi, API_URL } from "./api";
import { Button, Card, Field, Notice } from "./components";
import { colors } from "./theme";
import { errorMessage } from "./utils";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await authApi[mode](email.trim(), password);
      await onAuthenticated();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}><View style={styles.mark}><Text style={styles.markText}>↗</Text></View><Text style={styles.brand}>finvayo</Text></View>
        <Text style={styles.kicker}>90-day cash clarity</Text>
        <Text style={styles.title}>{mode === "login" ? "Welcome back." : "Build your cash outlook."}</Text>
        <Text style={styles.lede}>Know what your business can safely spend, without maintaining another spreadsheet.</Text>
        <Card>
          <View style={styles.switcher}>
            <Button label="Sign in" secondary={mode !== "login"} onPress={() => { setMode("login"); setError(""); }} />
            <Button label="Start free" secondary={mode !== "signup"} onPress={() => { setMode("signup"); setError(""); }} />
          </View>
          {error ? <Notice error>{error}</Notice> : null}
          <Field label="Work email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "signup" ? <Text style={styles.help}>Use at least 12 characters. By continuing, you accept Finvayo's terms and privacy policy.</Text> : null}
          <Button label={busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create my workspace"} disabled={busy || !email || password.length < (mode === "signup" ? 12 : 1)} onPress={submit} />
          {mode === "login" ? <Text onPress={() => Linking.openURL(`${API_URL}/forgot-password`)} style={styles.link}>Forgot password?</Text> : null}
        </Card>
        <Text style={styles.privacy}>Your amounts, clients, and projections are private. Finvayo never asks for bank credentials.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: { width: 36, height: 36, backgroundColor: colors.tealDark, alignItems: "center", justifyContent: "center" },
  markText: { color: colors.acid, fontSize: 23, fontWeight: "700" },
  brand: { fontFamily: "Manrope_800ExtraBold", fontSize: 24, color: colors.ink },
  kicker: { fontFamily: "SpaceMono_700Bold", color: colors.orange, textTransform: "uppercase", letterSpacing: 1.5, fontSize: 11, marginTop: 18 },
  title: { fontFamily: "Newsreader_700Bold", fontSize: 45, lineHeight: 47, color: colors.ink },
  lede: { fontFamily: "Manrope_500Medium", fontSize: 17, lineHeight: 25, color: colors.muted, marginBottom: 8 },
  switcher: { flexDirection: "row", gap: 8 },
  help: { fontFamily: "Manrope_500Medium", color: colors.muted, fontSize: 12, lineHeight: 18 },
  link: { fontFamily: "Manrope_700Bold", color: colors.teal, textAlign: "center", padding: 6 },
  privacy: { fontFamily: "Manrope_500Medium", color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 10 },
});
