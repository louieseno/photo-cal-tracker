import { useAtom, useSetAtom } from "jotai";
import type { FoodAnalysis } from "../schema/foodAnalysis";
import { nextSavedId, photoAtom, resultAtom, savedAtom } from "../state/atoms";
import { ConfidenceBanner } from "./ConfidenceBanner";
import { MealEditor } from "./MealEditor";

/**
 * The fresh-analysis editor: binds `resultAtom` to a `MealEditor`. Saving appends
 * the (possibly corrected) meal to the in-memory `savedAtom` log and clears both
 * `resultAtom` and `photoAtom` — that unmounts this card and resets the picker
 * preview, so the screen returns to a clean "pick a photo" state with the meal
 * now living in the Saved log. Only rendered for a food result.
 *
 * A low-confidence result still shows the editor (the user can correct it), but
 * tops it with an amber banner so the rough numbers aren't taken at face value.
 */
export function ResultCard() {
  const [result, setResult] = useAtom(resultAtom);
  const setSaved = useSetAtom(savedAtom);
  const setPhoto = useSetAtom(photoAtom);

  if (!result) return null;

  function handleSave(meal: FoodAnalysis) {
    setSaved((list) => [{ ...meal, id: nextSavedId(list) }, ...list]);
    discard();
  }

  // Discard the estimate without saving and reset to the clean "pick a photo"
  // state — same reset as a successful save, minus the append to the log.
  function discard() {
    setResult(null);
    setPhoto(null); // reset the picker preview back to "No photo selected"
  }

  return (
    <>
      {result.confidence === "low" ? (
        <ConfidenceBanner message="Rough estimate — please review and correct the numbers." />
      ) : null}
      <MealEditor
        meal={result}
        title="Review & edit"
        saveLabel="Save"
        onSave={handleSave}
        onCancel={discard}
      />
    </>
  );
}
