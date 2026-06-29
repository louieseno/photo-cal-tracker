/**
 * Image + request limits, enforced client-side so we never trip a model-side
 * 400 or an oversized upload. Claude downsizes anything past ~1568px on its long
 * edge anyway, so we do it here first — smaller upload, less latency, fewer
 * tokens. These mirror the server-side safety net in the Edge Function.
 */

/** Max long-edge in px; Claude's vision downsize threshold. */
export const MAX_IMAGE_LONG_EDGE = 1568;

/** JPEG quality after resize (0–1). 0.7 keeps food detail while shrinking size. */
export const IMAGE_COMPRESS = 0.7;

/** ~5 MB of base64 text. Matches MAX_BASE64_CHARS in the analyze-meal function. */
export const MAX_BASE64_CHARS = 5_000_000;

/** AbortController budget for the analyze request (wired in step 5). */
export const REQUEST_TIMEOUT_MS = 25_000;
