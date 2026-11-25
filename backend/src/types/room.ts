import type { ChatMessage, Player, RoomState, Settings, Stroke } from "./protocol.js";

export type Member = Player & {
  resumeToken: string;
  socketId: string | null;
};

export type Room = {
  code: string;
  hostId: string;
  members: Member[];
  settings: Settings;
  phase: RoomState["phase"];
  round: number;
  turn: number;
  totalTurns: number;
  drawerId: string | null;
  word: string;
  options: string[];
  hint: string;
  deadline: number | null;
  strokes: Stroke[];
  activeStroke: Stroke | null;
  chat: ChatMessage[];
  timer: NodeJS.Timeout | null;
  transition: NodeJS.Timeout | null;
  choiceTimer: NodeJS.Timeout | null;
};
