import mongoose from "mongoose";

const matchSchema = new mongoose.Schema({
  code: String,
  endedAt: Date,
  players: [{ name: String, score: Number }],
  winner: String,
});

export const MatchModel = mongoose.models.Match || mongoose.model("Match", matchSchema);
