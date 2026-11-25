import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import type {
  Ack,
  ClientToServerEvents,
  CreateRoomPayload,
  JoinRoomPayload,
  ServerToClientEvents,
  Settings,
} from "../types/protocol.js";
import type { Member } from "../types/room.js";
import { clearTimers, endTurn, resumeTimers } from "../services/gameService.js";
import {
  createRoom,
  findMemberBySocket,
  getRoom,
  getRoomCount,
  scheduleRoomCleanupIfEmpty,
  toRoomState,
  updateRoomSettings,
} from "../services/roomService.js";
import { safeName } from "../utils/sanitize.js";
import { socketLimiter } from "../middleware/rateLimit.js";
import { broadcastRoomState, type TypedServer } from "./broadcast.js";

const MAX_ROOMS = 500;

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function leaveRoom(io: TypedServer, socket: TypedSocket, immediate = true): void {
  const found = findMemberBySocket(socket.id);
  if (!found) return;
  const { room, player } = found;

  socket.leave(room.code);
  player.socketId = null;
  player.connected = false;

  if (room.hostId === player.id) {
    room.hostId = room.members.find((m) => m.connected)?.id || "";
  }
  if (immediate && room.phase === "lobby") {
    room.members = room.members.filter((m) => m.id !== player.id);
  }
  if (scheduleRoomCleanupIfEmpty(room, clearTimers)) {
    return;
  }
  if (!immediate && room.phase === "lobby") {
    const timer = setTimeout(() => {
      room.disconnectTimers.delete(player.id);
      if (!player.connected && room.phase === "lobby") {
        room.members = room.members.filter(member => member.id !== player.id);
        broadcastRoomState(io, room);
      }
    }, 60_000);
    room.disconnectTimers.set(player.id, timer);
  }
  if (room.drawerId === player.id && (room.phase === "drawing" || room.phase === "choosing")) {
    if (immediate) {
      endTurn(io, room);
    } else {
      const existingTimer = room.disconnectTimers.get(player.id);
      if (existingTimer) clearTimeout(existingTimer);
      const graceTimer = setTimeout(() => {
        room.disconnectTimers.delete(player.id);
        if (!player.connected && room.drawerId === player.id && (room.phase === "drawing" || room.phase === "choosing")) {
          endTurn(io, room);
        }
      }, 6000);
      room.disconnectTimers.set(player.id, graceTimer);
    }
  }
  if (room.phase === "drawing" && room.drawerId !== player.id) {
    const guessers = room.members.filter(member => member.connected && member.id !== room.drawerId);
    if (guessers.length > 0 && guessers.every(member => member.guessed)) endTurn(io, room);
  }
  broadcastRoomState(io, room);
}

export function registerRoomHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on("create_room", (payload: CreateRoomPayload, ack: (value: Ack) => void) => {
    if (typeof ack !== "function") return;
    if (!socketLimiter.allow(socket.id, "room_action", 10, 10_000)) {
      return ack({ ok: false, error: "Too many requests. Please wait a moment." });
    }
    if (getRoomCount() >= MAX_ROOMS) {
      return ack({ ok: false, error: "Studio is at capacity. Try again shortly." });
    }
    const name = safeName(payload?.name);
    if (!name) return ack({ ok: false, error: "Enter a display name." });

    leaveRoom(io, socket);
    const { room, player } = createRoom(name, socket.id, payload?.settings);
    socket.join(room.code);
    ack({ ok: true, code: room.code, playerId: player.id, resumeToken: player.resumeToken });
    broadcastRoomState(io, room);
  });

  socket.on("join_room", (payload: JoinRoomPayload, ack: (value: Ack) => void) => {
    if (typeof ack !== "function") return;
    if (!socketLimiter.allow(socket.id, "room_action", 10, 10_000)) {
      return ack({ ok: false, error: "Too many requests. Please wait a moment." });
    }
    const room = getRoom(String(payload?.code || ""));
    if (!room) return ack({ ok: false, error: "Room not found. Check the code." });

    const name = safeName(payload?.name);
    if (!name) return ack({ ok: false, error: "Enter a display name." });

    const existing = room.members.find((m) => m.resumeToken === payload?.resumeToken);
    if (existing?.socketId === socket.id) {
      ack({ ok: true, code: room.code, playerId: existing.id, resumeToken: existing.resumeToken });
      socket.emit("room_state", toRoomState(room));
      if (room.phase === "choosing" && room.drawerId === existing.id) {
        socket.emit("word_options", room.options);
      }
      if (room.phase === "drawing" && room.drawerId === existing.id) {
        socket.emit("your_word", room.word);
      }
      return;
    }

    if (!existing && room.phase !== "lobby") {
      return ack({ ok: false, error: "This game has already started." });
    }
    if (!existing && room.members.length >= room.settings.maxPlayers) {
      return ack({ ok: false, error: "This room is full." });
    }

    leaveRoom(io, socket);
    const player: Member = existing || {
      id: randomUUID(),
      resumeToken: randomUUID(),
      socketId: null,
      name,
      score: 0,
      connected: false,
      guessed: false,
      ready: false,
    };

    if (existing?.socketId && existing.socketId !== socket.id) {
      io.sockets.sockets.get(existing.socketId)?.disconnect(true);
    }

    player.socketId = socket.id;
    player.connected = true;
    if (room.cleanupTimer) { clearTimeout(room.cleanupTimer); room.cleanupTimer = null; }
    const pendingTimer = room.disconnectTimers.get(player.id);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      room.disconnectTimers.delete(player.id);
    }
    if (!existing) room.members.push(player);
    if (!room.hostId) room.hostId = player.id;

    socket.join(room.code);
    resumeTimers(io, room);
    ack({ ok: true, code: room.code, playerId: player.id, resumeToken: player.resumeToken });
    broadcastRoomState(io, room);

    if (room.phase === "choosing" && room.drawerId === player.id) {
      socket.emit("word_options", room.options);
    }
    if (room.phase === "drawing" && room.drawerId === player.id) {
      socket.emit("your_word", room.word);
    }
  });

  socket.on("leave_room", () => leaveRoom(io, socket));

  socket.on("toggle_ready", () => {
    const found = findMemberBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== "lobby") return;
    player.ready = !player.ready;
    broadcastRoomState(io, room);
  });

  socket.on("kick_player", (targetId: string) => {
    const found = findMemberBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.hostId !== player.id || targetId === player.id) return;

    const target = room.members.find((m) => m.id === targetId);
    if (!target) return;

    const targetSocket = target.socketId ? io.sockets.sockets.get(target.socketId) : null;
    if (targetSocket) {
      targetSocket.emit("kicked", "You were removed from the room by the host.");
      targetSocket.leave(room.code);
    }

    room.members = room.members.filter((m) => m.id !== targetId);
    if (room.drawerId === targetId && (room.phase === "drawing" || room.phase === "choosing")) {
      endTurn(io, room);
    }
    broadcastRoomState(io, room);
  });

  socket.on("play_again", () => {
    const found = findMemberBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.hostId !== player.id || room.phase !== "finished") return;

    clearTimers(room);
    room.phase = "lobby";
    room.round = 0;
    room.turn = 0;
    room.totalTurns = 0;
    room.turnOrder = [];
    room.drawerId = null;
    room.word = "";
    room.options = [];
    room.hint = "";
    room.deadline = null;
    room.strokes = [];
    room.activeStroke = null;
    room.chat = [];
    room.members = room.members.filter((m) => m.connected);
    for (const m of room.members) {
      m.score = 0;
      m.guessed = false;
      m.ready = m.id === room.hostId;
    }
    broadcastRoomState(io, room);
  });

  socket.on("update_settings", (value: Settings) => {
    const found = findMemberBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== "lobby" || room.hostId !== player.id) return;
    updateRoomSettings(room, value);
    broadcastRoomState(io, room);
  });

  socket.on("disconnect", () => {
    socketLimiter.clear(socket.id);
    leaveRoom(io, socket, false);
  });
}
