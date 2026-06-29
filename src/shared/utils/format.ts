/** Shared display formatters. */

/**
 * Render a nullable number for display: a real value as-is, or an em dash when
 * the model couldn't estimate it (and the user hasn't filled it in yet).
 */
export function formatNumber(value: number | null): string {
  return value == null ? "—" : String(value);
}

/**
 * Seed an editable numeric input from a stored value: a real number becomes its
 * string, `null` (the model's "unknown") becomes an empty field — not an em dash,
 * which belongs to read-only display only.
 */
export function numberToInput(value: number | null): string {
  return value == null ? "" : String(value);
}

/**
 * Restrict a text field to a non-negative decimal as it's typed: keep digits and
 * a single decimal point, drop everything else. `keyboardType` only changes the
 * on-screen keyboard, so this is what actually blocks letters/symbols from a
 * connected hardware keyboard.
 */
export function sanitizeDecimalInput(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  // Keep the first decimal point, strip any later ones.
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

/**
 * Parse a user-typed numeric field back into a stored value. Blank, non-numeric,
 * or negative input all collapse to `null` (unknown), so a bad keystroke can
 * never write garbage into the result.
 */
export function parseNumberInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}
