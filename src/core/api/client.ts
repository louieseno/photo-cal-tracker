import type { ApiError } from "./types";
import { REQUEST_TIMEOUT_MS } from "../../shared/constants/limits";

/**
 * Transport result of a single HTTP attempt, kept separate from the domain
 * `ApiResult` envelope so the two `ok` flags never get confused:
 *  - `ok: true`  → we reached the server and parsed a JSON body (which may
 *    itself be a domain success OR a domain error — the caller inspects it).
 *  - `ok: false` → we never got a usable response (timeout or network failure),
 *    carrying a typed transport error.
 */
export type TransportResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; error: ApiError };

type PostOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
};

/**
 * POST a JSON body with an AbortController timeout. Never throws — every failure
 * mode resolves to a typed `TransportResult`, so callers branch instead of
 * wrapping in try/catch. The function always replies with a JSON envelope (even
 * on 4xx/5xx), so we parse regardless of status and let the caller read it.
 */
export async function postJson(
  url: string,
  body: unknown,
  { headers, timeoutMs = REQUEST_TIMEOUT_MS }: PostOptions = {},
): Promise<TransportResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      // A non-JSON body (e.g. a gateway HTML error page) is an unusable response.
      return {
        ok: false,
        error: { code: "MODEL_ERROR", message: "The server returned an unreadable response." },
      };
    }

    return { ok: true, status: res.status, body: parsed };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        error: { code: "TIMEOUT", message: "Took too long — check your connection and retry." },
      };
    }
    return {
      ok: false,
      error: { code: "UNKNOWN", message: "Network request failed — check your connection." },
    };
  } finally {
    clearTimeout(timer);
  }
}
