import { StyleSheet, Text, View } from "react-native";
import { useAtomValue } from "jotai";
import { Button } from "../../../shared/components/Button";
import { colors } from "../../../shared/theme/colors";
import { errorAtom, statusAtom } from "../state/atoms";

type StateViewProps = {
  onRetry: () => void;
};

/**
 * Renders the error flow state as a pure function of `statusAtom`. Loading rides
 * on the PhotoPicker button's spinner; idle/success render nothing here (the
 * picker and result handle those). Step 7 layers the soft/hard distinction
 * (banners vs. Alerts) on top; for now both error states share one inline
 * message + Retry.
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
