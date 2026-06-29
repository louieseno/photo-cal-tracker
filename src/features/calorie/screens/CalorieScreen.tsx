import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAtomValue } from "jotai";
import { colors } from "../../../shared/theme/colors";
import { formatNumber } from "../../../shared/utils/format";
import { PhotoPicker } from "../components/PhotoPicker";
import { StateView } from "../components/StateView";
import { resultAtom, statusAtom } from "../state/atoms";
import { useAnalyzePhoto } from "../hooks/useAnalyzePhoto";

/**
 * The single app screen. Owns the one `useAnalyzePhoto` instance (the flow's
 * sole orchestrator) and composes the pieces:
 * photo picker → state view (loading/error) → result.
 * Step 4 added the picker; step 5 wires the call + shows a minimal estimate;
 * step 6 swaps the read-only summary below for the editable ResultCard.
 */
export function CalorieScreen() {
  const { pickPhoto, retry, isPicking } = useAnalyzePhoto();
  const status = useAtomValue(statusAtom);
  const result = useAtomValue(resultAtom);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Photo Calorie Tracker</Text>
        <Text style={styles.subtitle}>Pick a meal photo to estimate its nutrition.</Text>

        <PhotoPicker onPick={pickPhoto} isBusy={isPicking || status === "loading"} />
        <StateView onRetry={retry} />

        {status === "success" && result ? (
          <View style={styles.result}>
            {result.isFood ? (
              <>
                <Text style={styles.foodName}>{result.foodName || "Unknown food"}</Text>
                <Text style={styles.calories}>{formatNumber(result.calories)} kcal</Text>
                <Text style={styles.macros}>
                  Protein {formatNumber(result.macros.protein)}g · Carbs{" "}
                  {formatNumber(result.macros.carbs)}g · Fat {formatNumber(result.macros.fat)}g
                </Text>
                {result.notes ? <Text style={styles.notes}>{result.notes}</Text> : null}
              </>
            ) : (
              <Text style={styles.notes}>
                This doesn&apos;t look like food — try another photo.
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
  },
  result: {
    gap: 6,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  foodName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  calories: {
    fontSize: 16,
    color: colors.text,
  },
  macros: {
    fontSize: 14,
    color: colors.textMuted,
  },
  notes: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: "italic",
  },
});
