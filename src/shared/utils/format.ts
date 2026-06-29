/** Shared display formatters. */

/**
 * Render a nullable number for display: a real value as-is, or an em dash when
 * the model couldn't estimate it (and the user hasn't filled it in yet).
 */
export function formatNumber(value: number | null): string {
  return value == null ? "—" : String(value);
}
