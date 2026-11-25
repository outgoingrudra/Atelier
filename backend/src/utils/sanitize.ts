import {
  DEFAULT_SETTINGS,
  Point,
  Settings,
  WordCategory,
  WordMode,
} from "../types/protocol.js";

const VALID_MODES = new Set<WordMode>(["normal", "hidden", "combination"]);
const VALID_CATEGORIES = new Set<WordCategory>(["all", "animals", "food", "objects", "nature"]);

export function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function safeName(text: unknown): string {
  return typeof text === "string" ? text.trim().slice(0, 20).replace(/[<>]/g, "") : "";
}

export function safeText(text: unknown): string {
  return typeof text === "string" ? text.trim().slice(0, 160).replace(/[<>]/g, "") : "";
}

export function clamp(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== "number" && typeof n !== "string") return fallback;
  return Number.isFinite(Number(n))
    ? Math.max(min, Math.min(max, Math.round(Number(n))))
    : fallback;
}

export function safePoint(point: unknown): boolean {
  return (
    !!point &&
    typeof point === "object" &&
    Number.isFinite((point as Point).x) &&
    Number.isFinite((point as Point).y) &&
    (point as Point).x >= 0 &&
    (point as Point).x <= 1 &&
    (point as Point).y >= 0 &&
    (point as Point).y <= 1
  );
}

export function settingsFrom(value: unknown): Settings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<Settings>;
  const wordMode = VALID_MODES.has(v.wordMode as WordMode)
    ? (v.wordMode as WordMode)
    : DEFAULT_SETTINGS.wordMode;
  const category = VALID_CATEGORIES.has(v.category as WordCategory)
    ? (v.category as WordCategory)
    : DEFAULT_SETTINGS.category;

  return {
    maxPlayers: clamp(v.maxPlayers, 2, 20, DEFAULT_SETTINGS.maxPlayers),
    rounds: clamp(v.rounds, 2, 10, DEFAULT_SETTINGS.rounds),
    drawTime: clamp(v.drawTime, 15, 240, DEFAULT_SETTINGS.drawTime),
    wordCount: clamp(v.wordCount, 1, 5, DEFAULT_SETTINGS.wordCount),
    hints: clamp(v.hints, 0, 5, DEFAULT_SETTINGS.hints),
    isPrivate: v.isPrivate !== false,
    wordMode,
    category,
  };
}
