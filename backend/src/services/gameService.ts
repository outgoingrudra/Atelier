import type { Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/protocol.js";
import type { Member, Room } from "../types/room.js";
import {
  broadcastChatMessage,
  broadcastRoomState,
  emitSecretWord,
  emitWordOptions,
  type TypedServer,
} from "../socket/broadcast.js";
import { saveMatch } from "./matchService.js";
import {
  calculateGuessPoints,
  computeHint,
  DRAWER_GUESS_BONUS,
} from "./scoringService.js";
import { getWords } from "./wordService.js";
import { normalize } from "../utils/sanitize.js";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function clearTimers(room: Room): void {
  if (room.timer) clearInterval(room.timer);
  if (room.transition) clearTimeout(room.transition);
  if (room.choiceTimer) clearTimeout(room.choiceTimer);
  room.timer = room.transition = room.choiceTimer = null;
}

export function finishGame(io: TypedServer, room: Room): void {
  clearTimers(room);
  room.phase = "finished";
  room.deadline = null;
  broadcastRoomState(io, room);
  void saveMatch(
    room.code,
    room.members.map((m) => ({ name: m.name, score: m.score }))
  );
}

export function endTurn(io: TypedServer, room: Room): void {
  if (room.phase !== "drawing" && room.phase !== "choosing") return;
  clearTimers(room);
  room.phase = "result";
  room.deadline = null;
  room.activeStroke = null;
  broadcastChatMessage(
    io,
    room,
    "",
    "Studio",
    `The word was ${room.word || "not chosen"}.`,
    "system"
  );
  broadcastRoomState(io, room);
  room.transition = setTimeout(() => startTurn(io, room), 4500);
}

export function startDrawing(io: TypedServer, room: Room, chosen: string): void {
  if (room.phase !== "choosing" || !room.options.includes(chosen)) return;
  if (room.choiceTimer) clearTimeout(room.choiceTimer);
  room.choiceTimer = null;
  room.word = chosen;
  room.phase = "drawing";
  room.deadline = Date.now() + room.settings.drawTime * 1000;
  room.hint = computeHint(room.word, room.turn, room.settings, room.deadline);

  const drawer = room.members.find((m) => m.id === room.drawerId);
  if (drawer?.socketId) {
    emitSecretWord(io, drawer.socketId, chosen);
  }
  broadcastRoomState(io, room);

  room.timer = setInterval(() => {
    if (Date.now() >= (room.deadline || 0)) {
      endTurn(io, room);
      return;
    }
    const previousHint = room.hint;
    room.hint = computeHint(room.word, room.turn, room.settings, room.deadline);
    if (previousHint !== room.hint) {
      broadcastRoomState(io, room);
    }
  }, 1000);
}

export function startTurn(io: TypedServer, room: Room): void {
  clearTimers(room);
  if (room.turn >= room.totalTurns) {
    finishGame(io, room);
    return;
  }
  const eligible = room.members.filter((m) => m.connected);
  if (eligible.length < 2) {
    finishGame(io, room);
    return;
  }

  const drawer = eligible[room.turn % eligible.length];
  room.turn += 1;
  room.round = Math.ceil(room.turn / eligible.length);
  room.drawerId = drawer.id;
  room.phase = "choosing";
  room.word = "";
  room.options = getWords(room.settings.wordCount, room.settings.category);
  room.hint = "";
  room.deadline = null;
  room.strokes = [];
  room.activeStroke = null;
  room.chat = [];
  for (const m of room.members) m.guessed = false;

  broadcastRoomState(io, room);
  if (drawer.socketId) {
    emitWordOptions(io, drawer.socketId, room.options);
  }
  room.choiceTimer = setTimeout(() => startDrawing(io, room, room.options[0]), 12000);
}

export function resumeTimers(io: TypedServer, room: Room): void {
  if (room.phase === "choosing" && !room.choiceTimer) {
    room.choiceTimer = setTimeout(() => startDrawing(io, room, room.options[0]), 1000);
  }
  if (room.phase === "result" && !room.transition) {
    room.transition = setTimeout(() => startTurn(io, room), 1000);
  }
  if (room.phase === "drawing" && !room.timer) {
    if (Date.now() >= (room.deadline || 0)) {
      endTurn(io, room);
      return;
    }
    room.timer = setInterval(() => {
      if (Date.now() >= (room.deadline || 0)) {
        endTurn(io, room);
        return;
      }
      const previousHint = room.hint;
      room.hint = computeHint(room.word, room.turn, room.settings, room.deadline);
      if (previousHint !== room.hint) {
        broadcastRoomState(io, room);
      }
    }, 1000);
  }
}

export function startGame(io: TypedServer, room: Room): void {
  for (const m of room.members) m.score = 0;
  room.turn = 0;
  room.totalTurns = room.settings.rounds * room.members.filter((m) => m.connected).length;
  startTurn(io, room);
}

export function handleGuess(
  io: TypedServer,
  socket: TypedSocket,
  room: Room,
  player: Member,
  text: string
): void {
  if (normalize(text) === normalize(room.word)) {
    player.guessed = true;
    const points = calculateGuessPoints(room.deadline, room.settings.drawTime);
    player.score += points;

    const drawer = room.members.find((m) => m.id === room.drawerId);
    if (drawer) drawer.score += DRAWER_GUESS_BONUS;

    broadcastChatMessage(
      io,
      room,
      player.id,
      player.name,
      `${player.name} guessed the word!`,
      "correct"
    );
    socket.emit("guess_feedback", { correct: true, points });
    broadcastRoomState(io, room);

    const allGuessed = room.members
      .filter((m) => m.connected && m.id !== room.drawerId)
      .every((m) => m.guessed);
    if (allGuessed) {
      endTurn(io, room);
    }
  } else {
    broadcastChatMessage(io, room, player.id, player.name, text, "chat");
    socket.emit("guess_feedback", { correct: false, points: 0 });
  }
}
