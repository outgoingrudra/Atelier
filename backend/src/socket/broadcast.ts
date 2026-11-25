import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import type {
  ChatMessage,
  ClientToServerEvents,
  ServerToClientEvents,
} from "../types/protocol.js";
import type { Room } from "../types/room.js";
import { toRoomState } from "../services/roomService.js";

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function broadcastRoomState(io: TypedServer, room: Room): void {
  io.to(room.code).emit("room_state", toRoomState(room));
}

export function broadcastChatMessage(
  io: TypedServer,
  room: Room,
  playerId: string,
  playerName: string,
  text: string,
  kind: ChatMessage["kind"]
): void {
  const entry: ChatMessage = {
    id: randomUUID(),
    playerId,
    playerName,
    text,
    kind,
    at: Date.now(),
  };
  room.chat.push(entry);
  room.chat = room.chat.slice(-60);
  io.to(room.code).emit("chat_message", entry);
}

export function emitWordOptions(io: TypedServer, socketId: string, options: string[]): void {
  io.to(socketId).emit("word_options", options);
}

export function emitSecretWord(io: TypedServer, socketId: string, word: string): void {
  io.to(socketId).emit("your_word", word);
}
