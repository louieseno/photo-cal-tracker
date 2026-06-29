import { z } from "zod";
import type { ApiError, ApiErrorCode, ApiResult } from "../../../core/api/types";

/**
 * Single source of truth for the analysis result.
 *
 * Zod schema → inferred TS types (client + server) → JSON schema (handed to
 * Claude via `output_config.format`). Keeping all three in one file means the
 * Edge Function and the app can never drift out of sync.
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

export const FoodAnalysisSchema = z.object({
  isFood: z.boolean(),
  foodName: z.string(), // "" when not food
  calories: z.number().nonnegative().nullable(), // kcal estimate, null if unknown
  macros: MacrosSchema,
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().nullable(), // e.g. "blurry", "partial plate"
});

export type Macros = z.infer<typeof MacrosSchema>;
export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;

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
export const FOOD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isFood", "foodName", "calories", "macros", "confidence", "notes"],
  properties: {
    isFood: { type: "boolean" },
    foodName: { type: "string" },
    calories: { type: ["number", "null"] },
    macros: {
      type: "object",
      additionalProperties: false,
      required: ["protein", "carbs", "fat"],
      properties: {
        protein: { type: ["number", "null"] },
        carbs: { type: ["number", "null"] },
        fat: { type: ["number", "null"] },
      },
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: ["string", "null"] },
  },
} as const;
