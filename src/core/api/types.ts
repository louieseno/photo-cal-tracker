/**
 * Transport-layer API types, shared across every endpoint.
 *
 * The `ApiResult` envelope is what the api client (`client.ts`) returns for any
 * call — success carries typed `data`, failure carries a typed `error`. Feature
 * code never deals with raw responses; it switches on `ok` and gets a fully
 * typed result either way.
 *
 * `ApiErrorCode` covers transport/server failures common to all endpoints.
 * Features extend it with their own domain codes (e.g. the calorie feature adds
 * `NON_FOOD`) via the `Code` type parameter.
 */

export type ApiErrorCode =
  | "BAD_IMAGE"
  | "MODEL_ERROR"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "UNKNOWN";

export type ApiError<Code extends string = ApiErrorCode> = {
  code: Code;
  message: string;
};

export type ApiResult<T, Code extends string = ApiErrorCode> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError<Code> };
