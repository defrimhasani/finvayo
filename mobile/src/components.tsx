import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from "react-native";
import { colors } from "./theme";

export function Card({ children, dark = false }: PropsWithChildren<{ dark?: boolean }>) {
  return <View style={[styles.card, dark && styles.darkCard]}>{children}</View>;
}

export function Eyebrow({ children, light = false }: PropsWithChildren<{ light?: boolean }>) {
  return <Text style={[styles.eyebrow, light && styles.lightText]}>{children}</Text>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#8B8D87" style={styles.input} {...props} />
    </View>
  );
}

export function Button({ label, onPress, secondary = false, danger = false, disabled = false, icon }: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, danger && styles.dangerButton, (pressed || disabled) && styles.buttonMuted]}
    >
      {icon}
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

export function Choice<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.choice, value === option.value && styles.choiceActive]}>
          <Text style={[styles.choiceText, value === option.value && styles.choiceTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Notice({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  return <Text accessibilityLiveRegion="polite" style={[styles.notice, error && styles.errorNotice]}>{children}</Text>;
}

export function Loading() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={colors.teal} /><Text style={styles.muted}>Loading your cash plan...</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.ink, borderWidth: 1, padding: 18, gap: 14, shadowColor: colors.ink, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 },
  darkCard: { backgroundColor: colors.tealDark },
  eyebrow: { color: colors.teal, fontFamily: "SpaceMono_700Bold", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  lightText: { color: colors.acid },
  field: { gap: 7 },
  label: { color: colors.ink, fontFamily: "Manrope_700Bold", fontSize: 13 },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.white, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink, fontFamily: "Manrope_500Medium", fontSize: 16 },
  button: { minHeight: 50, backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  secondaryButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ink },
  dangerButton: { backgroundColor: colors.danger },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: colors.white, fontFamily: "Manrope_700Bold", fontSize: 14 },
  secondaryButtonText: { color: colors.ink },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card },
  choiceActive: { borderColor: colors.ink, backgroundColor: colors.acid },
  choiceText: { fontFamily: "Manrope_600SemiBold", color: colors.muted, fontSize: 13 },
  choiceTextActive: { color: colors.ink },
  notice: { color: colors.teal, backgroundColor: "#E3EEE9", padding: 12, fontFamily: "Manrope_600SemiBold", lineHeight: 20 },
  errorNotice: { color: colors.danger, backgroundColor: "#F4E3DF" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: colors.paper },
  muted: { color: colors.muted, fontFamily: "Manrope_500Medium" },
});
