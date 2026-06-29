# Supabase — `analyze-meal` Edge Function

The serverless function that holds the Anthropic API key. The Expo app sends a
base64 image; the function calls Claude vision and returns a validated nutrition
estimate. **The key lives only here** (a Supabase secret read via `Deno.env`) —
never in the app bundle, `app.json`, or the repo.

- Function code: `functions/analyze-meal/index.ts`
- Prompts: `functions/analyze-meal/prompts.ts`
- Shared schema (single source of truth, server + client): `../src/features/calorie/schema/foodAnalysis.ts`
- Gateway config (`verify_jwt = false` for the trial): `config.toml`

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase --version`)
- A Supabase project (the project ref is the subdomain of your project URL,
  e.g. `https://<ref>.supabase.co`)
- `supabase/.env` with your key (copy from `supabase/.env.example`):
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  ```

## One-time setup

```bash
# 1. Authenticate the CLI (opens a browser)
supabase login

# 2. Link this repo to your hosted project
supabase link --project-ref <your-project-ref>
```

Linking writes machine-specific metadata to `supabase/.temp/` — that directory is
gitignored, so each developer links their own clone.

## Deploy (hosted) — used for app testing

No Docker or local Deno needed; Supabase bundles the function server-side.

```bash
# Push the key as a server-side secret (reads ANTHROPIC_API_KEY from supabase/.env)
supabase secrets set --env-file supabase/.env

# Deploy the function
supabase functions deploy analyze-meal
```

The deploy bundles `functions/analyze-meal/*` **and** the shared
`src/features/calorie/schema/foodAnalysis.ts` it imports (the `import type` of
`core/api/types.ts` is erased, so that file is not uploaded). After deploying,
the function is live at:

```
https://<your-project-ref>.supabase.co/functions/v1/analyze-meal
```

The app reads this base URL from `EXPO_PUBLIC_SUPABASE_URL` in the root `.env`.

## Run locally (alternative) — needs Docker

```bash
supabase functions serve analyze-meal --env-file supabase/.env --no-verify-jwt
```

Serves at `http://localhost:54321/functions/v1/analyze-meal`. Point
`EXPO_PUBLIC_SUPABASE_URL` at that origin (use your machine's LAN IP, not
`localhost`, when testing on a physical device).

## Smoke-test the deployed function

`verify_jwt = false` makes the function public, so no auth header is required
(the app still sends the public anon key for forward-compatibility if JWT
verification is later turned on).

```bash
URL=https://<your-project-ref>.supabase.co/functions/v1/analyze-meal

# Validation path (no API cost) — expect 400 BAD_IMAGE
curl -s -X POST "$URL" -H "Content-Type: application/json" -d '{}'

# Live Claude call — base64 any image and post it
B64=$(base64 < some-image.png | tr -d '\n')
curl -s -X POST "$URL" -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$B64\",\"mediaType\":\"image/png\"}"
```

A non-food image returns `{"ok":true,"data":{"isFood":false,...}}`; a food image
returns `isFood:true` with a calorie/macro estimate.

## Managing the secret

```bash
supabase secrets list                       # names only (values are hidden)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # set/rotate directly
supabase secrets unset ANTHROPIC_API_KEY    # remove
```

Logs: Supabase Dashboard → Edge Functions → `analyze-meal` → Logs (the function
emits structured JSON on failures under the `analyze_failed` event).
