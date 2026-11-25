import { randomUUID } from "node:crypto";
import type { RoomState, Settings } from "../types/protocol.js";
import type { Member, Room } from "../types/room.js";
import { generateRoomCode } from "../utils/code.js";
import { settingsFrom } from "../utils/sanitize.js";

export const rooms = new Map<string, Room>();

export function getRoomCount(): number {
  return rooms.size;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function findMemberBySocket(socketId: string): { room: Room; player: Member } | null {
  for (const room of rooms.values()) {
    const player = room.members.find((m) => m.socketId === socketId);
    if (player) return { room, player };
  }
  return null;
}

export function toRoomState(room: Room): RoomState {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.members.map(({ id, name, score, connected, guessed, ready }) => ({
      id,
      name,
      score,
      connected,
      guessed,
      ready,
    })),
    settings: room.settings,
    phase: room.phase,
    round: room.round,
    turn: room.turn,
    totalTurns: room.totalTurns,
    drawerId: room.drawerId,
    hint: room.hint,
    wordLength: room.settings.wordMode === "hidden" ? 0 : room.word.length,
    deadline: room.deadline,
    resultWord: room.phase === "result" || room.phase === "finished" ? room.word : null,
    strokes: room.strokes,
    chat: room.chat,
  };
}

export function createRoom(name: string, socketId: string, rawSettings?: unknown): { room: Room; player: Member } {
  const roomCode = generateRoomCode(rooms);
  const player: Member = {
    id: randomUUID(),
    resumeToken: randomUUID(),
    socketId,
    name,
    score: 0,
    connected: true,
    guessed: false,
    ready: true,
  };

  const room: Room = {
    code: roomCode,
    hostId: player.id,
    members: [player],
    settings: settingsFrom(rawSettings),
    phase: "lobby",
    round: 0,
    turn: 0,
    totalTurns: 0,
    drawerId: null,
    word: "",
    options: [],
    hint: "",
    deadline: null,
    strokes: [],
    activeStroke: null,
    chat: [],
    timer: null,
    transition: null,
    choiceTimer: null,
  };

  rooms.set(roomCode, room);
  return { room, player };
}

export function updateRoomSettings(room: Room, rawSettings: Settings): void {
  room.settings = settingsFrom(rawSettings);
  room.settings.maxPlayers = Math.max(room.settings.maxPlayers, room.members.length);
}

export function scheduleRoomCleanupIfEmpty(room: Room, clearTimers: (room: Room) => void): boolean {
  if (room.members.some((m) => m.connected)) return false;

  clearTimers(room);
  setTimeout(() => {
    if (!room.members.some((m) => m.connected)) {
      rooms.delete(room.code);
    }
  }, 60_000);
  return true;
}
