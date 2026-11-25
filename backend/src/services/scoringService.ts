import type { Settings } from "../types/protocol.js";

export const DRAWER_GUESS_BONUS = 50;

export function calculateGuessPoints(deadline: number | null, drawTime: number): number {
  const seconds = Math.min(drawTime, Math.max(0, ((deadline || 0) - Date.now()) / 1000));
  return Math.round(100 + (400 * seconds) / drawTime);
}

export function computeHint(
  word: string,
  turn: number,
  settings: Settings,
  deadline: number | null
): string {
  if (!word) return "";
  if (settings.wordMode === "hidden") return "HIDDEN";

  const letters = [...word]
    .map((char, index) => (/[a-z]/i.test(char) ? index : -1))
    .filter((i) => i >= 0);

  const elapsed = settings.drawTime * 1000 - Math.max(0, (deadline || 0) - Date.now());
  const maxHints = settings.wordMode === "combination" ? Math.max(1, settings.hints) : settings.hints;
  const count = Math.min(
    Math.min(maxHints, Math.max(0, letters.length - 1)),
    Math.floor(elapsed / ((settings.drawTime * 1000) / (maxHints + 1)))
  );
  const reveal = letters
    .slice()
    .sort((a, b) => ((a * 17 + turn * 31) % 97) - ((b * 17 + turn * 31) % 97))
    .slice(0, count);

  return [...word]
    .map((char, index) => (char === " " ? " " : reveal.includes(index) ? char : "_"))
    .join(" ");
}
