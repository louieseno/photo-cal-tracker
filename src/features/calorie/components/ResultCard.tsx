import { useAtom, useSetAtom } from "jotai";
import type { FoodAnalysis } from "../schema/foodAnalysis";
import { nextSavedId, resultAtom, savedAtom } from "../state/atoms";
import { MealEditor } from "./MealEditor";

/**
 * The fresh-analysis editor: binds `resultAtom` to a `MealEditor`. Saving appends
 * the (possibly corrected) meal to the in-memory `savedAtom` log and clears
 * `resultAtom`, which unmounts this card — the meal now lives in the Saved log,
 * so there's nothing left to "review". Only rendered for a food result.
 */
export function ResultCard() {
  const [result, setResult] = useAtom(resultAtom);
  const setSaved = useSetAtom(savedAtom);

  if (!result) return null;

  function handleSave(meal: FoodAnalysis) {
    setSaved((list) => [{ ...meal, id: nextSavedId(list) }, ...list]);
    setResult(null);
  }

  return <MealEditor meal={result} title="Review & edit" saveLabel="Save" onSave={handleSave} />;
}
