import { z } from "zod";
import type { ApiError, ApiErrorCode, ApiResult } from "../../../core/api/types";

/**
 * Single source of truth for the analysis result.
 *
 * Zod schema → inferred TS types (client + server) → JSON schema (handed to
 * Claude via `output_config.format`). Keeping all three in one file means the
 * Edge Function and the app can never drift out of sync.
 *
 * The result is broken down **per ingredient**: the model lists each visible
 * component with its own calories/macros, and the meal total is the live sum of
 * those rows (`mealTotals`) — never a separate number that could disagree with
 * its parts. The user edits ingredients; the total recomputes.
 *
 * Note: Sonnet 4.6 structured-output schemas don't support numeric min/max, so
 * the JSON schema below stays purely structural and ranges (non-negative) are
 * enforced here in Zod, after parse.
 */

export const MacrosSchema = z.object({
  protein: z.number().nonnegative().nullable(), // grams, null if the model can't tell
  carbs: z.number().nonnegative().nullable(),
  fat: z.number().nonnegative().nullable(),
});

export const IngredientSchema = z.object({
  name: z.string(), // e.g. "Corn tortilla ×4", "Fried egg", "Black beans"
  calories: z.number().nonnegative().nullable(), // kcal for this component's visible amount
  macros: MacrosSchema,
});

export const FoodAnalysisSchema = z.object({
  isFood: z.boolean(),
  foodName: z.string(), // overall dish name, "" when not food
  ingredients: z.array(IngredientSchema), // [] when not food
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().nullable(), // e.g. "blurry", "partial plate"
});

export type Macros = z.infer<typeof MacrosSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;

/** A meal's rolled-up nutrition: the sum of its ingredient rows. */
export type Totals = { calories: number | null; macros: Macros };

/**
 * Sum a list of nullable numbers: nulls (the model's "unknown") are skipped, and
 * the result is `null` only when nothing is known — so a partial breakdown still
 * totals what it can instead of collapsing to nothing.
 */
function sumNullable(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value != null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}

/** Roll a (possibly user-edited) ingredient list up into a meal total. */
export function mealTotals(ingredients: Ingredient[]): Totals {
  return {
    calories: sumNullable(ingredients.map((item) => item.calories)),
    macros: {
      protein: sumNullable(ingredients.map((item) => item.macros.protein)),
      carbs: sumNullable(ingredients.map((item) => item.macros.carbs)),
      fat: sumNullable(ingredients.map((item) => item.macros.fat)),
    },
  };
}

/**
 * The calorie feature's response envelope: the shared `ApiResult` transport
 * type specialized to `FoodAnalysis`, plus the food-domain `NON_FOOD` code on
 * top of the shared transport codes. The app validates this before touching
 * state, so a malformed response becomes a clean error, never a crash.
 */
export type AnalyzeErrorCode = ApiErrorCode | "NON_FOOD";

export type AnalyzeError = ApiError<AnalyzeErrorCode>;

export type AnalyzeResponse = ApiResult<FoodAnalysis, AnalyzeErrorCode>;

/**
 * Structural subset of the schema handed to Claude (`output_config.format`).
 * All keys required, no extras, nullables expressed as `["<type>", "null"]`.
 * Numeric ranges are intentionally absent (unsupported + validated in Zod).
 */
const MACROS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["protein", "carbs", "fat"],
  properties: {
    protein: { type: ["number", "null"] },
    carbs: { type: ["number", "null"] },
    fat: { type: ["number", "null"] },
  },
} as const;

export const FOOD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isFood", "foodName", "ingredients", "confidence", "notes"],
  properties: {
    isFood: { type: "boolean" },
    foodName: { type: "string" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "calories", "macros"],
        properties: {
          name: { type: "string" },
          calories: { type: ["number", "null"] },
          macros: MACROS_JSON_SCHEMA,
        },
      },
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: ["string", "null"] },
  },
} as const;
