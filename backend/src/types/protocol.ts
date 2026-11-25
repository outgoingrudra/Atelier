export type Phase = "lobby" | "choosing" | "drawing" | "result" | "finished";
export type Tool = "pen" | "eraser";
export type WordMode = "normal" | "hidden" | "combination";
export type WordCategory = "all" | "animals" | "food" | "objects" | "nature";
export type Point = { x: number; y: number };
export type Stroke = { id: string; color: string; size: number; tool: Tool; points: Point[] };
export type Settings = {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints: number;
  isPrivate: boolean;
  wordMode: WordMode;
  category: WordCategory;
};
export type Player = {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  guessed: boolean;
  ready: boolean;
};
export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  kind: "chat" | "system" | "correct";
  at: number;
};
export type RoomState = {
  code: string;
  hostId: string;
  players: Player[];
  settings: Settings;
  phase: Phase;
  round: number;
  turn: number;
  totalTurns: number;
  drawerId: string | null;
  hint: string;
  wordLength: number;
  deadline: number | null;
  resultWord: string | null;
  strokes: Stroke[];
  chat: ChatMessage[];
};
export type Ack =
  | { ok: true; code: string; playerId: string; resumeToken: string }
  | { ok: false; error: string };

export const DEFAULT_SETTINGS: Settings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  wordCount: 3,
  hints: 2,
  isPrivate: true,
  wordMode: "normal",
  category: "all",
};

export type CreateRoomPayload = { name?: string; settings?: Partial<Settings> };
export type JoinRoomPayload = { code?: string; name?: string; resumeToken?: string };
export type DrawStartPayload = {
  id?: string;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
  tool?: string;
};
export type DrawMovePayload = { id?: string; x?: number; y?: number };
export type DrawEndPayload = { id?: string };
export type GuessFeedback = { correct: boolean; points: number };

export interface ClientToServerEvents {
  create_room: (payload: CreateRoomPayload, ack: (value: Ack) => void) => void;
  join_room: (payload: JoinRoomPayload, ack: (value: Ack) => void) => void;
  leave_room: () => void;
  toggle_ready: () => void;
  kick_player: (playerId: string) => void;
  play_again: () => void;
  update_settings: (value: Settings) => void;
  start_game: () => void;
  word_chosen: (value: string) => void;
  draw_start: (value: DrawStartPayload) => void;
  draw_move: (value: DrawMovePayload) => void;
  draw_end: (value: DrawEndPayload) => void;
  draw_undo: () => void;
  canvas_clear: () => void;
  guess: (raw: string) => void;
}

export interface ServerToClientEvents {
  room_state: (state: RoomState) => void;
  chat_message: (message: ChatMessage) => void;
  word_options: (options: string[]) => void;
  your_word: (word: string) => void;
  draw_start: (stroke: Stroke) => void;
  draw_move: (point: DrawMovePayload) => void;
  draw_end: (payload: DrawEndPayload) => void;
  canvas_state: (strokes: Stroke[]) => void;
  guess_feedback: (feedback: GuessFeedback) => void;
  kicked: (reason: string) => void;
}
