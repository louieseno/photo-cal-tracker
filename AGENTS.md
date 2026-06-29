# Expo SDK version

This project is pinned to **Expo SDK 54** (RN 0.81, React 19.1). It is intentionally NOT on SDK 56:
the App Store / Play Store build of Expo Go does not support SDK 56 yet, so 56 fails in Expo Go with
`UnexpectedServerData: No returned query result`. See `docs/SPEC.md` for the full project plan.

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any Expo code.

# Tech stack

| Area | Choice |
|---|---|
| App | Expo (React Native) + TypeScript, **one screen** |
| Runtime | Expo SDK 54 — RN 0.81.5, React 19.1.0 |
| State | Jotai atoms |
| Validation | Zod — one schema, shared by server and client |
| Photo | `expo-image-picker` (library only, no camera) + `expo-image-manipulator` (downsize/encode) |
| Backend | Supabase Edge Function (Deno) — holds the Anthropic key |
| Vision model | Claude `claude-sonnet-4-6`, via the Anthropic TS SDK, with Structured Outputs |

The Anthropic API key lives **only** in the Edge Function (a Supabase secret read via
`Deno.env`). It is never in the app bundle, `app.json`, or the repo. The app talks to the
function with the public Supabase anon key. No auth, no database — saved meals are in-memory.

# Project structure

```
src/
├── core/api/                  # transport layer, reusable by any endpoint
│   ├── types.ts               # ApiResult<T> envelope + error codes
│   ├── client.ts              # fetch wrapper: timeout, typed errors, never throws
│   └── endpoints.ts           # analyze endpoint URL + anon key from env
├── features/calorie/
│   ├── components/
│   │   ├── PhotoPicker.tsx     # pick button + image preview
│   │   ├── MealEditor.tsx      # reusable editor: ingredient rows + live total
│   │   ├── ResultCard.tsx      # binds resultAtom → MealEditor (fresh result)
│   │   ├── SavedMeals.tsx      # in-memory log: edit-in-place + delete
│   │   ├── ConfidenceBanner.tsx# inline "not food" / "low confidence" banner
│   │   └── StateView.tsx       # inline error + retry (transport/server failures)
│   ├── hooks/
│   │   └── useAnalyzePhoto.ts  # orchestrates pick → encode → call → state
│   ├── schema/
│   │   └── foodAnalysis.ts     # Zod schema + inferred types + JSON schema (source of truth)
│   ├── screens/
│   │   └── CalorieScreen.tsx   # composes the one screen
│   ├── services/
│   │   └── analyzePhoto.ts     # POST base64 → re-validated AnalyzeResponse
│   └── state/
│       └── atoms.ts            # Jotai: photo, status, result, error, saved
└── shared/
    ├── components/Button.tsx
    ├── constants/limits.ts     # max image dims/bytes, request timeout
    ├── theme/colors.ts
    └── utils/format.ts         # number formatting + decimal input sanitizing

supabase/functions/analyze-meal/
├── index.ts                    # the Edge Function (Deno) — holds the key
└── prompts.ts                  # system + user prompts

App.tsx                         # mounts CalorieScreen inside the Jotai + SafeArea providers
```

`schema/foodAnalysis.ts` is imported by **both** the app and the Edge Function, so the two
can never drift. See `docs/SPEC.md` for the full plan and reasoning.
