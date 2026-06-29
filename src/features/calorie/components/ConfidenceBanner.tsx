import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../../shared/theme/colors";

type Tone = "warning" | "info";

type ConfidenceBannerProps = {
  message: string;
  tone?: Tone;
};

/**
 * Inline banner for the soft signals that come from the *model itself* (not a
 * transport failure): a low-confidence estimate (amber "warning") or a not-food
 * photo ("info"). Neither is an error — the flow succeeded — so this is kept
 * separate from `StateView`, which renders network/server failures + Retry.
 */
export function ConfidenceBanner({ message, tone = "warning" }: ConfidenceBannerProps) {
  const isWarning = tone === "warning";
  return (
    <View style={[styles.banner, isWarning ? styles.warning : styles.info]}>
      <Text style={[styles.text, isWarning ? styles.warningText : styles.infoText]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  warning: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warning,
  },
  info: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  text: {
    fontSize: 14,
  },
  warningText: {
    color: colors.warning,
    fontWeight: "600",
  },
  infoText: {
    color: colors.textMuted,
  },
});
