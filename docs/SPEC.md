# Photo-to-Calorie Screen — Technical Spec & Build Plan

A small Expo (React Native) + TypeScript app: pick a meal photo from the library,
send it to Claude's vision model through a serverless function (key stays server-side),
and show back the meal broken into its visible ingredients — each with a calorie and
macro estimate — that sum to a live meal total. The user can review, correct, add/remove
ingredients, and save to an in-memory log they can later edit or delete. Messy cases
(non-food photo, uncertain or failed model response, network/timeout errors) are handled
gracefully without crashing.

## 0. Decisions locked

| Area | Choice |
|---|---|
| App | Expo (React Native) + TypeScript, **one screen** |
| Photo source | `expo-image-picker` (library only, no camera) |
| Vision model | Claude **`claude-sonnet-4-6`** (vision-capable) |
| Backend | **Supabase Edge Function** holding the key |
| API call | **Anthropic TS SDK** (`@anthropic-ai/sdk`) |
| Reliability | **Structured Outputs** (`output_config.format`, JSON schema) — guaranteed-parseable, no prefill |
| State | **Jotai** atoms |
| Errors | **Mixed** — inline banner/card for soft cases (non-food, low confidence), `Alert` for hard failures (network/timeout/server) |
| Validation | **Zod** in `schema/` → inferred TS types, validated on both server and client |

**Supabase runtime note:** Edge Functions run on **Deno**, not Node. We import the SDK with
the `npm:` specifier (`import Anthropic from "npm:@anthropic-ai/sdk"`) and read the key with
`Deno.env.get(...)`. The code reads like normal Node/TS. This is the only place the runtime
matters.

> **Backend tradeoff (Vercel vs. Supabase):** A Vercel serverless function is marginally
> simpler for an Expo-only repo (a single `/api` file, Node runtime, native `fetch`). We chose
> Supabase Edge Functions per requirement; the cost is the Deno runtime (handled via the `npm:`
> specifier above). Either keeps the key server-side — that is the property that matters.

---

## 1. Folder structure (scaled down to this one feature)

```
photo-calorie-app/
├── src/
│   ├── core/
│   │   └── api/
│   │       ├── types.ts           # shared ApiResult<T> envelope + ApiError/codes
│   │       ├── client.ts          # fetch wrapper → Supabase fn (timeout, typed errors)
│   │       └── endpoints.ts       # ANALYZE endpoint URL + anon key from env
│   ├── features/
│   │   └── calorie/
│   │       ├── components/
│   │       │   ├── PhotoPicker.tsx      # pick button + image preview
│   │       │   ├── MealEditor.tsx       # reusable editor: ingredient rows + live total
│   │       │   ├── ResultCard.tsx       # binds resultAtom → MealEditor (fresh result)
│   │       │   ├── SavedMeals.tsx       # in-memory log: edit-in-place + delete
│   │       │   ├── ConfidenceBanner.tsx # inline "uncertain / not food" banner
│   │       │   └── StateView.tsx        # idle / loading / error states
│   │       ├── hooks/
│   │       │   └── useAnalyzePhoto.ts   # orchestrates pick→encode→call→state
│   │       ├── schema/
│   │       │   └── foodAnalysis.ts      # Zod schema + inferred types + JSON schema
│   │       ├── screens/
│   │       │   └── CalorieScreen.tsx    # composes the screen
│   │       ├── services/
│   │       │   └── analyzePhoto.ts      # POST base64 → returns validated result
│   │       └── state/
│   │           └── atoms.ts             # Jotai: photo, result (editable), status
│   └── shared/
│       ├── components/
│       │   └── Button.tsx
│       ├── constants/
│       │   └── limits.ts          # max image dims/bytes, request timeout
│       └── theme/
│           └── colors.ts
├── supabase/
│   └── functions/
│       └── analyze-meal/
│           └── index.ts           # the Edge Function (Deno) — holds the key
├── assets/
├── App.tsx                        # mounts CalorieScreen inside Jotai Provider
├── index.ts
├── app.json
├── package.json
└── tsconfig.json
```

**Deliberately omitted** (evaluator said "keep it small"): no navigation library (one screen),
no auth, no DB, no env-management library beyond Expo's built-in `EXPO_PUBLIC_*` + Supabase
secrets.

---

## 2. The result type — layered: transport (`core/api`) + domain (`feature/schema`)

The result type splits across two layers so the transport envelope is reusable while the food
domain stays feature-scoped:

- **`src/core/api/types.ts`** — the generic `ApiResult<T>` envelope every endpoint returns,
  plus `ApiError<Code>` and the transport `ApiErrorCode` codes. Reusable by any future endpoint.
- **`src/features/calorie/schema/foodAnalysis.ts`** — the food domain: Zod schema → inferred TS
  type → JSON schema for the model, plus the calorie envelope specialized from `ApiResult`.

Single source of truth — Zod schema → inferred TS type → JSON schema for the model. Note
Sonnet 4.6 structured-output schemas don't support numeric `min`/`max`, so ranges (non-negative)
are validated in Zod after parse, not in the model's schema.

```ts
// src/core/api/types.ts — shared transport layer
export type ApiErrorCode = "BAD_IMAGE" | "MODEL_ERROR" | "RATE_LIMIT" | "TIMEOUT" | "UNKNOWN";
export type ApiError<Code extends string = ApiErrorCode> = { code: Code; message: string };
export type ApiResult<T, Code extends string = ApiErrorCode> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError<Code> };
```

```ts
// src/features/calorie/schema/foodAnalysis.ts — food domain
import { z } from "zod";
import type { ApiError, ApiErrorCode, ApiResult } from "../../../core/api/types";

export const MacrosSchema = z.object({
  protein: z.number().nonnegative().nullable(), // grams, null if model can't tell
  carbs: z.number().nonnegative().nullable(),
  fat: z.number().nonnegative().nullable(),
});

// The meal is broken down per ingredient; the meal total is the sum of the rows
// (see mealTotals below), never a separate number that could disagree with its parts.
export const IngredientSchema = z.object({
  name: z.string(),                                // e.g. "Corn tortilla ×4"
  calories: z.number().nonnegative().nullable(),   // kcal for this component's amount
  macros: MacrosSchema,
});

export const FoodAnalysisSchema = z.object({
  isFood: z.boolean(),
  foodName: z.string(),                            // overall dish name, "" when not food
  ingredients: z.array(IngredientSchema),          // [] when not food
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().nullable(),                    // e.g. "blurry", "partial plate"
});

export type Macros = z.infer<typeof MacrosSchema>;
export type Ingredient = z.infer<typeof IngredientSchema>;
export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;

// Roll the (possibly user-edited) ingredient list up into a meal total. Nulls are
// skipped; the total is null only when nothing is known, so a partial breakdown
// still totals what it can. Used by the editor's live total and the saved log.
export function mealTotals(ingredients: Ingredient[]): {
  calories: number | null;
  macros: Macros;
};

// Calorie envelope: shared ApiResult, specialized to FoodAnalysis + the one
// food-domain code (NON_FOOD) layered onto the shared transport codes.
export type AnalyzeErrorCode = ApiErrorCode | "NON_FOOD";
export type AnalyzeError = ApiError<AnalyzeErrorCode>;
export type AnalyzeResponse = ApiResult<FoodAnalysis, AnalyzeErrorCode>;
```

The **JSON schema** handed to Claude (`output_config.format`) is the structural subset —
`additionalProperties: false`, all keys required, `ingredients` as an array of ingredient
objects, nullables as `["number","null"]`. It lives in `foodAnalysis.ts` as `FOOD_JSON_SCHEMA`
(one source of truth shared by server + client), not inlined in the function.

---

## 3. The Edge Function (`supabase/functions/analyze-meal/index.ts`)

**Image transport: base64 JSON, not multipart.** The app sends `{ imageBase64, mediaType }` as
a JSON POST. Rationale: Claude's vision API consumes base64 directly, RN→multipart is fiddly,
and the payload is small once we downsize client-side (§5). The function forwards the same
base64 straight into the image content block — no re-encoding.

**Key handling:** the Anthropic key lives **only** here, read from the environment:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

It is never in the Expo bundle, `app.json`, or the repo. The app authenticates to the function
with the Supabase **anon** key (public by design); for the trial we keep `verify_jwt = false`
so no login is needed. Production would add rate-limiting / an app check.

**Shape of the function:**

```ts
import Anthropic from "npm:@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

Deno.serve(async (req) => {
  // CORS preflight + POST only
  const { imageBase64, mediaType } = await req.json();
  if (!imageBase64) return json({ ok:false, error:{ code:"BAD_IMAGE", message:"No image" }}, 400);

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      thinking: { type: "disabled" },           // simple extraction, keep it fast/cheap
      system: SYSTEM_PROMPT,                      // §4
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: USER_PROMPT },    // §4
        ],
      }],
      output_config: { format: { type: "json_schema", schema: FOOD_JSON_SCHEMA } },
    });

    const text = res.content.find(b => b.type === "text")?.text ?? "";
    const parsed = FoodAnalysisSchema.safeParse(JSON.parse(text)); // belt-and-suspenders
    if (!parsed.success) return json({ ok:false, error:{ code:"MODEL_ERROR", message:"Unparseable result" }}, 502);

    // Map model's own non-food verdict onto a soft error the UI treats specially
    return json({ ok:true, data: parsed.data }, 200);
  } catch (e) {
    // Anthropic SDK typed errors → mapped codes
    if (e instanceof Anthropic.RateLimitError) return json({ ok:false, error:{ code:"RATE_LIMIT", message:"Busy, try again" }}, 429);
    if (e?.status === 400 || e instanceof Anthropic.BadRequestError) return json({ ok:false, error:{ code:"BAD_IMAGE", message:"Image rejected" }}, 400);
    return json({ ok:false, error:{ code:"MODEL_ERROR", message:"Model failed" }}, 502);
  }
});
```

**Vision input limits** enforced client-side so we never hit a 400: **≤ ~5 MB base64 per
image**, long edge **≤ 1568 px** (Claude downsizes above that anyway — sending smaller saves
tokens, latency, and upload time). Constants live in `shared/constants/limits.ts`.

---

## 4. The prompt (returns structured JSON, handles non-food)

`output_config.format` already *forces* schema-valid JSON, so the prompt's job is accuracy and
the non-food/uncertainty signal — not formatting.

**System prompt:**

> You are a nutrition estimator. You are given one photo. Identify the meal and break it down
> into its visible ingredients. For each ingredient, give a short name (include the count or
> amount when it helps, e.g. "Corn tortilla ×4", "Black beans ~1/2 cup") and estimate its
> calories (kcal) and macros (grams of protein, carbs, fat) for the amount visible. Keep the
> list to the main components a person would log — typically 2 to 6 ingredients; group trivial
> garnishes rather than listing each. Set `foodName` to a short name for the overall dish. Do
> NOT return a separate total; the app sums the ingredients. Estimates are approximate; that is
> expected. If the image does not contain food (e.g. a person, object, screenshot, or scenery),
> set `isFood` to false, `foodName` to "", and `ingredients` to an empty array. Set `confidence`
> to "low" when the image is blurry, partial, ambiguous, or the portion is hard to judge; "high"
> only when the food and portions are clearly identifiable. Use `notes` for one short caveat
> (e.g. "portions estimated", "blurry"). Never refuse; if unsure, return your best guess with
> low confidence. Use null for any number you genuinely cannot estimate.

**User prompt:**

> Analyze this meal photo and return the nutrition estimate.

**Parsing reliability (defense in depth):**

1. Structured Outputs guarantees the first text block is schema-valid JSON.
2. `JSON.parse` wrapped in try/catch.
3. `FoodAnalysisSchema.safeParse` re-validates → any drift becomes a clean `MODEL_ERROR`,
   never a crash.
4. Client re-validates the envelope again before touching state.

---

## 5. Messy-case handling, end to end

| Case | Detected where | What the user sees |
|---|---|---|
| **Non-food photo** | Model returns `isFood:false` | Inline `ConfidenceBanner`: *"This doesn't look like food — try another photo."* Result card hidden. No crash, no alert. |
| **Low-confidence / blurry** | `confidence:"low"` (+ `notes`) | Result card shown **but** topped with an amber inline banner: *"Rough estimate — please review and correct."* Fields are editable. |
| **Missing numbers** | an ingredient's `calories`/macros `null` | That field renders empty; the row contributes nothing to the total until the user types a value in (numeric fields are sanitized to a non-negative decimal). Save still works. |
| **Model returns junk / schema drift** | `safeParse` fails server-side → `MODEL_ERROR` | Inline error card with **Retry** button. |
| **Network failure / no internet** | `fetch` rejects in `client.ts` | `Alert` (hard failure) + inline retry. |
| **Timeout** | `AbortController` (~25s) in `client.ts` → `TIMEOUT` | `Alert`: *"Took too long — check your connection and retry."* |
| **Rate limit / 429** | Mapped to `RATE_LIMIT` | `Alert`: *"Service busy, try again in a moment."* |
| **Image too large / rejected** | Client pre-check, or `BAD_IMAGE` | Inline: *"Couldn't read this photo — pick another."* |

The split matches the "mixed" choice: **soft/expected → inline**, **hard/exceptional → Alert +
inline retry**. Every path resolves to a known UI state (`idle | picking | loading | success |
softError | hardError`) held in a Jotai status atom — the screen is a pure function of that, so
nothing can crash mid-flight.

---

## 6. State (`state/atoms.ts`, Jotai)

```ts
photoAtom:  { uri, base64, mediaType } | null
statusAtom: "idle" | "loading" | "success" | "softError" | "hardError"
resultAtom: FoodAnalysis | null        // the editable, corrected copy
errorAtom:  AnalyzeError | null
savedAtom:  SavedMeal[]                 // in-memory log; SavedMeal = FoodAnalysis & { id }
```

- On success, the **server result is held in `resultAtom`**; `ResultCard` renders it through
  `MealEditor`, where the user edits the dish name and each ingredient row (add/remove rows; the
  total is the live sum). "Save" appends the corrected meal to `savedAtom` and clears
  `resultAtom`, which unmounts the editor — the meal now lives in the log.
- `SavedMeals` renders `savedAtom` (newest first) and reuses the same `MealEditor` to **edit a
  row in place** (keeping its id) or **delete** it (confirmed via `Alert`). Ids come from
  `nextSavedId(list)` — one past the max existing id, so deletes never cause id reuse. In memory
  only — no DB, as specified.
- `useAnalyzePhoto` is the only writer of `statusAtom`, keeping transitions in one place.

---

## 7. Build sequence

1. **Scaffold** — `create-expo-app` (TS), add folders, `colors.ts`, `Button`, install
   `expo-image-picker`, `jotai`, `zod`. App renders an empty `CalorieScreen` in a Jotai
   `Provider`.
2. **Schema first** — write `foodAnalysis.ts` (Zod + inferred types + JSON schema). Everything
   downstream imports these types.
3. **Edge Function** — build `analyze-meal` with a hardcoded test image, deploy, set the
   secret, confirm structured JSON comes back and the key is server-only. *Prove the riskiest
   integration early.*
4. **Photo pick + encode** — `PhotoPicker` + `useAnalyzePhoto`: pick from library,
   downsize/encode to base64 within limits, show preview.
5. **Wire the call** — `client.ts` (timeout + typed errors) → `analyzePhoto.ts` service →
   atoms. Happy path: photo → real estimate on screen.
6. **Result card + editing** — `MealEditor` (ingredient rows + live total) reused by
   `ResultCard` (fresh result, bound to `resultAtom`) and `SavedMeals` (in-memory log with
   edit-in-place + delete). "Save" appends to `savedAtom` and clears the result.
7. **Messy cases** — implement the §5 table: non-food banner, low-confidence banner, retry
   card, Alerts for network/timeout/429. Test each by feeding a non-food image, a blurry image,
   airplane mode, and a forced 500.
8. **Polish + README** — short README: how to set the secret, run the function, run the app,
   and the Vercel-vs-Supabase / key-safety note. Light styling via `colors.ts`.

This front-loads the two things the evaluator weighs most — *does it work with the key off the
client* (steps 2–3) and *messy-case handling* (step 7) — and leaves visual polish last, matching
"clean and typed over heavy design."
