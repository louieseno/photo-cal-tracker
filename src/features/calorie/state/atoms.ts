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

/** The editable, corrected copy of the model's result (the ResultCard binds it). */
export const resultAtom = atom<FoodAnalysis | null>(null);

/** The last transport/domain error, for the inline error view + retry. */
export const errorAtom = atom<AnalyzeError | null>(null);

/**
 * A saved meal: a snapshot of the (possibly user-corrected) result plus a local
 * id for list keys. In memory only — no DB, as specified.
 */
export type SavedMeal = FoodAnalysis & { id: string };

/** The in-memory log of saved meals, newest first. Cleared on app restart. */
export const savedAtom = atom<SavedMeal[]>([]);

/**
 * Next id for the saved log: one past the largest existing id. Derived from the
 * list itself (no module-global counter), but using the max rather than the
 * length so an id is never reused after a row is deleted.
 */
export function nextSavedId(meals: SavedMeal[]): string {
  const max = meals.reduce((highest, meal) => Math.max(highest, Number(meal.id)), 0);
  return String(max + 1);
}
