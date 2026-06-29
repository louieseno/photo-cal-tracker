/**
 * Endpoint + auth config, read from Expo's public env (`EXPO_PUBLIC_*`, inlined
 * into the bundle at build time). These are public by design: the URL and the
 * Supabase **anon** key are safe to ship in the client. The Anthropic key is NOT
 * here — it lives only in the Edge Function's server-side secret.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loud in dev rather than letting a bare `undefined/functions/...` URL
  // produce a confusing network error at call time. Copy .env.example → .env.
  console.warn(
    "[endpoints] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — " +
      "copy .env.example to .env and restart the dev server.",
  );
}

/** The analyze-meal Edge Function URL. */
export const ANALYZE_ENDPOINT = `${SUPABASE_URL ?? ""}/functions/v1/analyze-meal`;

/** Supabase anon key — public, used to authenticate the function call. */
export const ANON_KEY = SUPABASE_ANON_KEY ?? "";
