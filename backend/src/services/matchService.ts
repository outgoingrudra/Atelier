import { isDatabaseConnected } from "../config/db.js";
import { MatchModel } from "../models/match.model.js";

export async function saveMatch(
  code: string,
  players: { name: string; score: number }[]
): Promise<void> {
  if (!isDatabaseConnected()) return;
  const sorted = [...players].sort((a, b) => b.score - a.score);
  try {
    await MatchModel.create({
      code,
      endedAt: new Date(),
      players: sorted,
      winner: sorted[0]?.name,
    });
  } catch (error) {
    console.error("Could not save match:", error);
  }
}
