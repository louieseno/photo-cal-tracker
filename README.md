# Photo Calorie Tracker

Snap-free calorie logging: pick a meal photo from your library, and the app figures out
what's on the plate and roughly how many calories and macros it adds up to. It breaks the
meal into ingredients you can correct, then saves it to a simple log you can edit later.

It's one screen. Pick a photo → get an estimate → tweak the numbers → save.

## How it works

The photo never goes straight to Claude from your phone. Instead it goes to a small
**Supabase Edge Function** that holds the Anthropic API key and talks to Claude's vision
model on the server. The key stays on the server — it's never in the app, the repo, or
`app.json`. The app only carries Supabase's public anon key, which is meant to be public.

```
phone  →  Supabase Edge Function (has the API key)  →  Claude vision
       ←  ingredients + calories + macros (JSON)     ←
```

Claude returns the meal as a list of ingredients, each with its own calories and macros.
The app adds them up live, so the total always matches the parts — and when you edit a row,
the total just reflows.

## Run it

You'll need [Node](https://nodejs.org), the [Expo Go](https://expo.dev/go) app on your
phone, and a [Supabase](https://supabase.com) project. The app is on **Expo SDK 54** on
purpose (see `AGENTS.md` for why).

**1. Install**

```bash
npm install
```

**2. Point the app at your Supabase project**

Copy `.env.example` to `.env` and fill in your project URL and anon key (both are safe to
ship — they're public):

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

**3. Deploy the function (this is where the secret API key lives)**

```bash
supabase login
supabase link --project-ref <your-ref>

# Put your Anthropic key on the server — never in the app
supabase secrets set --env-file supabase/.env   # supabase/.env holds ANTHROPIC_API_KEY=sk-ant-...

supabase functions deploy analyze-meal
```

More detail on the function lives in [`supabase/README.md`](supabase/README.md).

**4. Start the app**

```bash
npx expo start
```

Scan the QR code with Expo Go, tap **Pick a meal photo**, and you're off.

## When things go wrong

Food photos are messy, networks drop, and models sometimes shrug. The app expects all of
that and never crashes:

- **Not a food photo?** It says so and asks for another — no fake numbers.
- **Blurry or unsure?** You still get an estimate, with a heads-up to double-check it.
- **Missing a number?** That field is just left blank; you can fill it in, and the total
  still adds up what it knows.
- **Network drop, timeout, or server hiccup?** A clear message and a **Try again** button.

Soft, expected stuff (not food, low confidence) shows up gently inline. Hard failures
(no internet, timeout, server error) pop an alert and let you retry.

## A couple of choices worth knowing

- **Supabase Edge Functions** hold the key. A Vercel function would've been a touch simpler
  for an Expo-only repo, but either way the point is the same: the key stays off the phone.
- **In-memory only.** Saved meals live for the session — there's no database, by design.
  This is a focused trial, not a backend.
- **Typed end to end.** One Zod schema is the single source of truth, shared by the server
  and the app, so the two can't drift. Full plan and reasoning in
  [`docs/SPEC.md`](docs/SPEC.md).
