import { Image, StyleSheet, Text, View } from "react-native";
import { useAtomValue } from "jotai";
import { Button } from "../../../shared/components/Button";
import { colors } from "../../../shared/theme/colors";
import { photoAtom } from "../state/atoms";

type PhotoPickerProps = {
  onPick: () => void;
  /** True while picking/encoding OR analyzing — the button shows the spinner. */
  isBusy: boolean;
};

/**
 * Pick button + image preview. Presentational: the picked photo lives in
 * `photoAtom` (so the preview re-renders for free), and the pick action +
 * busy flag are driven by the screen's `useAnalyzePhoto` instance. The button's
 * spinner doubles as the "analyzing" indicator, so there's no separate loading
 * row — and being busy also disables it, blocking a re-pick mid-analysis.
 */
export function PhotoPicker({ onPick, isBusy }: PhotoPickerProps) {
  const photo = useAtomValue(photoAtom);

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={styles.placeholder}>No photo selected</Text>
        )}
      </View>
      <Button
        label={photo ? "Choose a different photo" : "Pick a meal photo"}
        onPress={onPick}
        loading={isBusy}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  preview: {
    aspectRatio: 4 / 3,
    width: "100%",
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    fontSize: 15,
    color: colors.textMuted,
  },
});
