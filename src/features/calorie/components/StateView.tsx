import { StyleSheet, Text, View } from "react-native";
import { useAtomValue } from "jotai";
import { Button } from "../../../shared/components/Button";
import { colors } from "../../../shared/theme/colors";
import { errorAtom, statusAtom } from "../state/atoms";

type StateViewProps = {
  onRetry: () => void;
};

/**
 * The inline error view + Retry, a pure function of `statusAtom`. Both soft and
 * hard failures show here; hard ones additionally fire an `Alert` from
 * `useAnalyzePhoto` (SPEC §5's soft-inline / hard-Alert split). Model-originated
 * signals (non-food, low confidence) are *not* errors and render as
 * `ConfidenceBanner`s elsewhere — this view is only for transport/server failures.
 * Loading rides on the PhotoPicker button's spinner; idle/success render nothing.
 */
export function StateView({ onRetry }: StateViewProps) {
  const status = useAtomValue(statusAtom);
  const error = useAtomValue(errorAtom);

  if (status === "softError" || status === "hardError") {
    return (
      <View style={styles.error}>
        <Text style={styles.errorText}>
          {error?.message ?? "Something went wrong. Please try again."}
        </Text>
        <Button label="Try again" onPress={onRetry} variant="secondary" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  error: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.dangerBg,
  },
  errorText: {
    fontSize: 15,
    color: colors.danger,
  },
});
