import { atom } from "jotai";
import type { AnalyzeError, FoodAnalysis } from "../schema/foodAnalysis";

/**
 * The picked + encoded photo, ready to POST. `base64` is the raw JPEG data (no
 * `data:` URI prefix) the Edge Function forwards straight into Claude's image
 * block; `uri` is the local cache file used only for the on-screen preview.
 * mediaType is always image/jpeg because the picker output is normalized to JPEG
 * during downsizing (see useAnalyzePhoto).
 */
export type PickedPhoto = {
  uri: string;
  base64: string;
  mediaType: "image/jpeg";
};

/**
 * The screen is a pure function of `statusAtom`, so no async path can leave it
 * in an inconsistent state. `useAnalyzePhoto` is the only writer:
 *  idle → loading → success | softError | hardError.
 * Soft = expected/recoverable (bad image, non-food); hard = exceptional
 * (network, timeout, rate limit, model failure). Step 7 maps each onto its UI.
 */
export type Status = "idle" | "loading" | "success" | "softError" | "hardError";

export const photoAtom = atom<PickedPhoto | null>(null);
export const statusAtom = atom<Status>("idle");

/** The editable, corrected copy of the model's result (step 6 binds the card). */
export const resultAtom = atom<FoodAnalysis | null>(null);

/** The last transport/domain error, for the inline error view + retry. */
export const errorAtom = atom<AnalyzeError | null>(null);
