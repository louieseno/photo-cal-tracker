import { z } from "zod";
import { postJson } from "../../../core/api/client";
import { ANALYZE_ENDPOINT, ANON_KEY } from "../../../core/api/endpoints";
import { FoodAnalysisSchema } from "../schema/foodAnalysis";
import type { AnalyzeResponse } from "../schema/foodAnalysis";
import type { PickedPhoto } from "../state/atoms";

/**
 * Client-side re-validation of the server envelope (SPEC §4, defense in depth
 * step 4). Even though the function already validates with this same Zod schema,
 * we never trust the wire: a malformed body becomes a clean MODEL_ERROR instead
 * of crashing the UI on a bad field access.
 */
const AnalyzeErrorCodeSchema = z.enum([
  "BAD_IMAGE",
  "MODEL_ERROR",
  "RATE_LIMIT",
  "TIMEOUT",
  "UNKNOWN",
  "NON_FOOD",
]);

const EnvelopeSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), data: FoodAnalysisSchema }),
  z.object({
    ok: z.literal(false),
    error: z.object({ code: AnalyzeErrorCodeSchema, message: z.string() }),
  }),
]);

/**
 * POST the encoded photo to the Edge Function and return a fully validated
 * `AnalyzeResponse`. Authenticates with the public Supabase anon key (Bearer +
 * apikey). Always resolves — transport failures and schema drift both come back
 * as typed `ok:false` results, so the caller has a single shape to handle.
 */
export async function analyzePhoto(photo: PickedPhoto): Promise<AnalyzeResponse> {
  const transport = await postJson(
    ANALYZE_ENDPOINT,
    { imageBase64: photo.base64, mediaType: photo.mediaType },
    { headers: { Authorization: `Bearer ${ANON_KEY}`, apikey: ANON_KEY } },
  );

  // Never reached the server (timeout / network / unreadable body).
  if (!transport.ok) {
    return { ok: false, error: transport.error };
  }

  const parsed = EnvelopeSchema.safeParse(transport.body);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "MODEL_ERROR", message: "The server returned an unexpected result." },
    };
  }

  return parsed.data;
}
