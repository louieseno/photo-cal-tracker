import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAtomValue } from "jotai";
import { colors } from "../../../shared/theme/colors";
import { PhotoPicker } from "../components/PhotoPicker";
import { ResultCard } from "../components/ResultCard";
import { SavedMeals } from "../components/SavedMeals";
import { StateView } from "../components/StateView";
import { resultAtom, statusAtom } from "../state/atoms";
import { useAnalyzePhoto } from "../hooks/useAnalyzePhoto";

/**
 * The single app screen. Owns the one `useAnalyzePhoto` instance (the flow's
 * sole orchestrator) and composes the pieces:
 * photo picker → state view (error) → editable result card → saved log.
 * Step 6 shows the editable ResultCard + in-memory save; step 7 will layer the
 * non-food / low-confidence banners over the placeholder line below.
 */
export function CalorieScreen() {
  const { pickPhoto, retry, isPicking } = useAnalyzePhoto();
  const status = useAtomValue(statusAtom);
  const result = useAtomValue(resultAtom);

  const showResult = status === "success" && result;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Photo Calorie Tracker</Text>
        <Text style={styles.subtitle}>Pick a meal photo to estimate its nutrition.</Text>

        <PhotoPicker onPick={pickPhoto} isBusy={isPicking || status === "loading"} />
        <StateView onRetry={retry} />

        {showResult ? (
          result.isFood ? (
            <ResultCard />
          ) : (
            <Text style={styles.notFood}>
              This doesn&apos;t look like food — try another photo.
            </Text>
          )
        ) : null}

        <SavedMeals />
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
  notFood: {
    fontSize: 15,
    color: colors.textMuted,
    fontStyle: "italic",
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
});
