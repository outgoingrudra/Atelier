import type { Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/protocol.js";
import { handleGuess, startDrawing, startGame } from "../services/gameService.js";
import { findMemberBySocket } from "../services/roomService.js";
import { safeText } from "../utils/sanitize.js";
import { socketLimiter } from "../middleware/rateLimit.js";
import type { TypedServer } from "./broadcast.js";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerGameHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on("start_game", () => {
    const found = findMemberBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (
      room.phase !== "lobby" ||
      room.hostId !== player.id ||
      room.members.filter((m) => m.connected).length < 2 ||
      room.members.some((m) => m.connected && m.id !== room.hostId && !m.ready)
    ) {
      return;
    }
    startGame(io, room);
  });

  socket.on("word_chosen", (value: string) => {
    const found = findMemberBySocket(socket.id);
    if (found && found.room.drawerId === found.player.id) {
      startDrawing(io, found.room, value);
    }
  });

  socket.on("guess", (raw: string) => {
    if (!socketLimiter.allow(socket.id, "guess", 10, 5_000)) return;
    const found = findMemberBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    const text = safeText(raw);
    if (!text || room.phase !== "drawing" || room.drawerId === player.id || player.guessed) {
      return;
    }
    handleGuess(io, socket, room, player, text);
  });
}
