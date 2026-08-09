export type ThemePreference = "dark" | "light" | "custom";
export type DensityPreference = "compact" | "comfortable";
export type CurrencyPreference = "eur" | "usd" | "jpy";

/**
 * Which topology layer(s) the canvas shows. Filtering to one layer is also the
 * simplest way to cut edge overlap: fewer edges, fewer crossings.
 */
export type LayerView = "all" | "physical" | "logical";

export interface CustomPalette {
  accent: string;
  surface: string;
  text: string;
}

export interface UserProfile {
  displayName: string;
  email: string;
  userId: string;
  role: string;
}

export const storageKeys = {
  theme: "netdash:theme",
  trafficMode: "netdash:traffic-mode",
  density: "netdash:density",
  currency: "netdash:currency",
  customPalette: "netdash:custom-palette",
  layerView: "netdash:layer-view",
} as const;

export const defaultCustomPalette: CustomPalette = {
  accent: "#2dd4bf",
  surface: "#10243b",
  text: "#e6f6ff",
};

export function readStoredPreference<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  return (window.localStorage.getItem(key) as T | null) ?? fallback;
}

export function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.localStorage.getItem(key);
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getCurrencySymbol(currency: CurrencyPreference) {
  if (currency === "usd") {
    return "$";
  }
  if (currency === "jpy") {
    return "¥";
  }
  return "€";
}

export function formatCurrency(value: number, currency: CurrencyPreference) {
  return `${getCurrencySymbol(currency)}${value.toFixed(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex: string, fallback: string) {
  const trimmed = hex.trim();
  const source = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  if (/^[0-9a-fA-F]{3}$/.test(source)) {
    return `#${source
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(source)) {
    return `#${source.toLowerCase()}`;
  }

  return fallback;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex, "#000000");
  const value = normalized.slice(1);

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHexColors(leftHex: string, rightHex: string, weight: number) {
  const left = hexToRgb(leftHex);
  const right = hexToRgb(rightHex);
  const ratio = clamp(weight, 0, 1);

  return rgbToHex(
    left.r + (right.r - left.r) * ratio,
    left.g + (right.g - left.g) * ratio,
    left.b + (right.b - left.b) * ratio,
  );
}

function rgbaFromHex(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`;
}

function getContrastColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0b1320" : "#f8fafc";
}

export function clearCustomPalette() {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const customVariables = [
    "--app-bg",
    "--panel-bg",
    "--panel-border",
    "--panel-shadow",
    "--panel-subtle-bg",
    "--panel-subtle-border",
    "--text-primary",
    "--text-muted",
    "--button-bg",
    "--button-border",
    "--button-text",
    "--button-primary-bg",
    "--button-primary-text",
    "--canvas-bg",
    "--edge-stroke",
    "--edge-stroke-muted",
    "--edge-activity",
    "--edge-activity-secondary",
    "--label-bg",
    "--label-text",
    "--label-border",
  ];

  for (const variable of customVariables) {
    root.style.removeProperty(variable);
  }
}

export function applyCustomPalette(palette: CustomPalette) {
  if (typeof document === "undefined") {
    return;
  }

  const accent = normalizeHex(palette.accent, defaultCustomPalette.accent);
  const surface = normalizeHex(palette.surface, defaultCustomPalette.surface);
  const text = normalizeHex(palette.text, defaultCustomPalette.text);
  const mutedText = mixHexColors(text, surface, 0.38);
  const elevatedSurface = mixHexColors(surface, "#020617", 0.26);
  const canvasBase = mixHexColors(surface, "#020617", 0.42);
  const secondaryAccent = mixHexColors(accent, "#22c55e", 0.35);

  const root = document.documentElement;
  root.style.setProperty(
    "--app-bg",
    `radial-gradient(circle at 18% 18%, ${mixHexColors(accent, "#ffffff", 0.12)} 0%, ${surface} 38%, ${mixHexColors(surface, "#020617", 0.5)} 100%)`,
  );
  root.style.setProperty("--panel-bg", rgbaFromHex(surface, 0.82));
  root.style.setProperty("--panel-border", rgbaFromHex(text, 0.18));
  root.style.setProperty("--panel-shadow", "0 18px 44px rgba(2, 6, 23, 0.34)");
  root.style.setProperty("--panel-subtle-bg", rgbaFromHex(elevatedSurface, 0.62));
  root.style.setProperty("--panel-subtle-border", rgbaFromHex(text, 0.14));
  root.style.setProperty("--text-primary", text);
  root.style.setProperty("--text-muted", mutedText);
  root.style.setProperty("--button-bg", rgbaFromHex(mixHexColors(surface, accent, 0.08), 0.94));
  root.style.setProperty("--button-border", rgbaFromHex(accent, 0.26));
  root.style.setProperty("--button-text", text);
  root.style.setProperty("--button-primary-bg", accent);
  root.style.setProperty("--button-primary-text", getContrastColor(accent));
  root.style.setProperty("--canvas-bg", rgbaFromHex(canvasBase, 0.82));
  root.style.setProperty("--edge-stroke", accent);
  root.style.setProperty("--edge-stroke-muted", rgbaFromHex(text, 0.48));
  root.style.setProperty("--edge-activity", accent);
  root.style.setProperty("--edge-activity-secondary", secondaryAccent);
  root.style.setProperty("--label-bg", rgbaFromHex(mixHexColors(surface, "#020617", 0.32), 0.94));
  root.style.setProperty("--label-text", text);
  root.style.setProperty("--label-border", rgbaFromHex(accent, 0.28));
}
