import { useState } from "react";
import { Alert } from "react-native";
import { useAtomValue, useSetAtom } from "jotai";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  errorAtom,
  photoAtom,
  resultAtom,
  statusAtom,
  type PickedPhoto,
} from "../state/atoms";
import { analyzePhoto } from "../services/analyzePhoto";
import type { AnalyzeErrorCode } from "../schema/foodAnalysis";
import {
  IMAGE_COMPRESS,
  MAX_BASE64_CHARS,
  MAX_IMAGE_LONG_EDGE,
} from "../../../shared/constants/limits";

/** Expected, recoverable failures shown inline; everything else is a hard error. */
const SOFT_CODES: ReadonlySet<AnalyzeErrorCode> = new Set(["BAD_IMAGE", "NON_FOOD"]);

/**
 * Title for the hard-failure Alert, per error code. The body is the error's own
 * message (already user-facing). Soft codes never reach here — they render
 * inline only.
 */
function hardAlertTitle(code: AnalyzeErrorCode): string {
  switch (code) {
    case "TIMEOUT":
      return "Request timed out";
    case "RATE_LIMIT":
      return "Service is busy";
    case "MODEL_ERROR":
      return "Couldn't analyze photo";
    default:
      return "Something went wrong";
  }
}

/**
 * Orchestrates the whole flow and is the sole writer of `statusAtom`, so screen
 * state can never desync: pick → downsize → encode → analyze → success/error.
 * `retry` re-runs analysis against the already-picked photo.
 */
export function useAnalyzePhoto() {
  const photo = useAtomValue(photoAtom);
  const setPhoto = useSetAtom(photoAtom);
  const setStatus = useSetAtom(statusAtom);
  const setResult = useSetAtom(resultAtom);
  const setError = useSetAtom(errorAtom);
  const [isPicking, setIsPicking] = useState(false);

  async function runAnalysis(target: PickedPhoto) {
    setStatus("loading");
    setError(null);

    const response = await analyzePhoto(target);
    if (response.ok) {
      setResult(response.data);
      setStatus("success");
      return;
    }

    setError(response.error);
    const isSoft = SOFT_CODES.has(response.error.code);
    setStatus(isSoft ? "softError" : "hardError");

    // Hard failures (network/timeout/429/server) get an Alert on top of the
    // inline retry, per SPEC §5's soft-inline / hard-Alert split. Firing here in
    // the sole orchestrator means it shows exactly once per attempt, not per render.
    if (!isSoft) {
      Alert.alert(hardAlertTitle(response.error.code), response.error.message);
    }
  }

  async function pickPhoto() {
    // On iOS the system picker often grants access implicitly, but requesting is
    // harmless and gives Android (and stricter iOS) a clean denial path.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo library access in Settings to pick a meal photo.",
      );
      return;
    }

    setIsPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 1, // we re-compress during downsizing; keep the source clean here
      });
      if (result.canceled) return;

      const picked = await encodePhoto(result.assets[0]);
      if (!picked) {
        Alert.alert(
          "Couldn't use that photo",
          "It may be too large or unreadable — pick a different image.",
        );
        return;
      }

      setPhoto(picked);
      setResult(null); // drop any prior estimate before analyzing the new photo
      await runAnalysis(picked);
    } catch {
      // Any picker/encode failure is a soft, recoverable problem — never crash.
      Alert.alert("Couldn't load photo", "Something went wrong. Please try again.");
    } finally {
      setIsPicking(false);
    }
  }

  async function retry() {
    if (photo) await runAnalysis(photo);
  }

  return { pickPhoto, retry, isPicking };
}

/**
 * Downsize to MAX_IMAGE_LONG_EDGE on the long edge and re-encode as JPEG base64.
 * Resizing only the long edge preserves aspect ratio; `min(...)` prevents
 * upscaling a small photo. Re-encoding normalizes every source format (HEIC,
 * PNG, …) to a single image/jpeg the function can forward as-is. Returns null if
 * the result is missing or still over the size cap.
 */
async function encodePhoto(
  asset: ImagePicker.ImagePickerAsset,
): Promise<PickedPhoto | null> {
  const { uri, width, height } = asset;
  const resize =
    width >= height
      ? { width: Math.min(width, MAX_IMAGE_LONG_EDGE) }
      : { height: Math.min(height, MAX_IMAGE_LONG_EDGE) };

  const rendered = await ImageManipulator.manipulate(uri).resize(resize).renderAsync();
  const output = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: IMAGE_COMPRESS,
    base64: true,
  });

  if (!output.base64 || output.base64.length > MAX_BASE64_CHARS) return null;
  return { uri: output.uri, base64: output.base64, mediaType: "image/jpeg" };
}
