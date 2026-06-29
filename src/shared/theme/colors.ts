/**
 * App color palette — organized as 100–900 shade scales (light → dark).
 * Kept small: one screen, light theme. Semantic roles map onto these shades.
 */
export const palette = {
  gray: {
    100: "#F5F6F8",
    200: "#E2E4E9",
    300: "#C7CBD1",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#1A1C1E",
  },
  blue: {
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
    900: "#1E3A8A",
  },
  amber: {
    100: "#FEF3C7",
    200: "#FDE68A",
    300: "#FCD34D",
    400: "#FBBF24",
    500: "#F59E0B",
    600: "#D97706",
    700: "#B45309",
    800: "#92400E",
    900: "#78350F",
  },
  red: {
    100: "#FEE2E2",
    200: "#FECACA",
    300: "#FCA5A5",
    400: "#F87171",
    500: "#EF4444",
    600: "#DC2626",
    700: "#B91C1C",
    800: "#991B1B",
    900: "#7F1D1D",
  },
} as const;

/**
 * Semantic roles — reference the shade scales above so usage stays consistent.
 */
export const colors = {
  background: "#FFFFFF",
  surface: palette.gray[100],
  border: palette.gray[200],
  text: palette.gray[900],
  textMuted: palette.gray[500],
  primary: palette.blue[600],
  primaryText: "#FFFFFF",
  disabled: palette.gray[300],

  // Status accents (used by banners in later steps)
  warning: palette.amber[700],
  warningBg: palette.amber[100],
  danger: palette.red[700],
  dangerBg: palette.red[100],
} as const;

export type Palette = typeof palette;
export type Colors = typeof colors;
