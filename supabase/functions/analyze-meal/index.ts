// supabase/functions/analyze-meal/index.ts
//
// Edge Function (Deno runtime) — the ONLY place the Anthropic API key lives.
// It is read from the environment (`supabase secrets set ANTHROPIC_API_KEY=...`)
// and is never shipped in the Expo bundle, app.json, or the repo. The app calls
// this function with the Supabase anon key (public by design); `verify_jwt` is
// off for the trial (see supabase/config.toml).
//
// Contract:  POST { imageBase64, mediaType }  ->  AnalyzeResponse
// The schema, JSON schema, and validator are the SAME source-of-truth file the
// app uses, so server and client can never drift (see ../../../src/.../schema).
//
// Deno note: the SDK and zod come in via the `npm:` specifiers mapped in
// ./deno.json. `import type { ... }` is erased before resolution, so the shared
// schema file's type-only import of core/api/types never has to resolve here.

import Anthropic from "@anthropic-ai/sdk";
import {
  FOOD_JSON_SCHEMA,
  FoodAnalysisSchema,
} from "../../../src/features/calorie/schema/foodAnalysis.ts";
import type {
  AnalyzeErrorCode,
  AnalyzeResponse,
} from "../../../src/features/calorie/schema/foodAnalysis.ts";
import { SYSTEM_PROMPT, USER_PROMPT } from "./prompts.ts";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

// Vision input limits. The app downsizes before sending (see SPEC §3/§5); this
// is a server-side safety net so an oversized or non-image payload becomes a
// clean BAD_IMAGE, never a 400 from the model or an OOM here.
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BASE64_CHARS = 5_000_000; // ~5 MB of base64 text

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: AnalyzeResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const fail = (code: AnalyzeErrorCode, message: string): AnalyzeResponse => ({
  ok: false,
  error: { code, message },
});

Deno.serve(async (req) => {
  // CORS preflight + method guard.
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, fail("UNKNOWN", "Method not allowed."));

  // Parse + validate the request body.
  let imageBase64: unknown;
  let mediaType: unknown;
  try {
    ({ imageBase64, mediaType } = await req.json());
  } catch {
    return json(400, fail("BAD_IMAGE", "Request body was not valid JSON."));
  }

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return json(400, fail("BAD_IMAGE", "No image was provided."));
  }
  if (typeof mediaType !== "string" || !ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return json(400, fail("BAD_IMAGE", "Unsupported image type — use JPEG, PNG, WebP, or GIF."));
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    return json(400, fail("BAD_IMAGE", "Image is too large — pick a smaller photo."));
  }

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      thinking: { type: "disabled" }, // simple extraction — keep it fast and cheap
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
      // Structured Outputs: the model is constrained to schema-valid JSON.
      output_config: { format: { type: "json_schema", schema: FOOD_JSON_SCHEMA } },
    });

    // Defense in depth: structured outputs already guarantees schema-valid JSON,
    // but we still JSON.parse in a try/catch and re-validate with the SAME Zod
    // schema the client uses (which also enforces the non-negative ranges the
    // JSON schema can't express). Any drift becomes a clean MODEL_ERROR.
    const textBlock = res.content.find((b) => b.type === "text");
    const rawText = textBlock?.type === "text" ? textBlock.text : "";

    let json_: unknown;
    try {
      json_ = JSON.parse(rawText);
    } catch {
      return json(502, fail("MODEL_ERROR", "The model returned an unreadable result."));
    }

    const parsed = FoodAnalysisSchema.safeParse(json_);
    if (!parsed.success) {
      return json(502, fail("MODEL_ERROR", "The model returned an unexpected result."));
    }

    // Non-food is NOT an error here: the model's verdict (isFood:false) rides
    // back as normal data, and the app surfaces it as a soft inline banner.
    return json(200, { ok: true, data: parsed.data });
  } catch (err) {
    // Map the Anthropic SDK's typed errors onto our transport codes.
    if (err instanceof Anthropic.RateLimitError) {
      return json(429, fail("RATE_LIMIT", "Service is busy — try again in a moment."));
    }
    if (err instanceof Anthropic.BadRequestError) {
      return json(400, fail("BAD_IMAGE", "The image was rejected — pick another photo."));
    }
    // Structured so the platform log is filterable (Dashboard → Edge Functions
    // → Logs). Captured at error level via console.error.
    console.error(
      JSON.stringify({
        event: "analyze_failed",
        name: err instanceof Error ? err.name : typeof err,
        status: err instanceof Anthropic.APIError ? err.status : undefined,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return json(502, fail("MODEL_ERROR", "The model could not analyze this photo."));
  }
});
