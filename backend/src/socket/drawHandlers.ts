import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  DrawEndPayload,
  DrawMovePayload,
  DrawStartPayload,
  ServerToClientEvents,
  Stroke,
} from "../types/protocol.js";
import { findMemberBySocket } from "../services/roomService.js";
import { clamp, safePoint } from "../utils/sanitize.js";
import { socketLimiter } from "../middleware/rateLimit.js";
import type { TypedServer } from "./broadcast.js";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerDrawHandlers(io: TypedServer, socket: TypedSocket): void {
  socket.on("draw_start", (value: DrawStartPayload) => {
    if (!socketLimiter.allow(socket.id, "draw_action", 25, 1_000)) return;
    const found = findMemberBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== "drawing" || room.drawerId !== player.id || !safePoint(value)) return;

    if (room.activeStroke) {
      room.strokes.push(room.activeStroke);
      room.strokes = room.strokes.slice(-250);
    }
    const stroke: Stroke = {
      id: typeof value.id === "string" ? value.id.slice(0, 50) : randomUUID(),
      color:
        typeof value.color === "string" && /^#[0-9a-fA-F]{6}$/.test(value.color)
          ? value.color
          : "#25221f",
      size: clamp(value.size, 2, 36, 6),
      tool: value.tool === "eraser" ? "eraser" : "pen",
      points: [{ x: value.x!, y: value.y! }],
    };
    room.activeStroke = stroke;
    socket.to(room.code).emit("draw_start", stroke);
  });

  socket.on("draw_move", (value: DrawMovePayload) => {
    if (!socketLimiter.allow(socket.id, "draw_move", 100, 1_000)) return;
    const found = findMemberBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    const active = room.activeStroke;
    if (
      room.phase !== "drawing" ||
      room.drawerId !== player.id ||
      !safePoint(value) ||
      !active ||
      active.id !== value.id ||
      active.points.length >= 1000
    ) {
      return;
    }
    active.points.push({ x: value.x!, y: value.y! });
    socket.to(room.code).emit("draw_move", value);
  });

  socket.on("draw_end", (value: DrawEndPayload) => {
    const found = findMemberBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    const active = room.activeStroke;
    if (room.phase !== "drawing" || room.drawerId !== player.id || !active || active.id !== value?.id) return;

    if (Array.isArray(value.points) && value.points.length > 0) {
      const validPoints = value.points.slice(0, 1000).filter(safePoint);
      if (validPoints.length > 0) {
        active.points = validPoints.map((p) => ({ x: p.x, y: p.y }));
      }
    }

    room.strokes.push(active);
    room.strokes = room.strokes.slice(-250);
    room.activeStroke = null;
    socket.to(room.code).emit("draw_end", { id: active.id, points: active.points });
  });

  socket.on("draw_undo", () => {
    if (!socketLimiter.allow(socket.id, "draw_action", 25, 1_000)) return;
    const found = findMemberBySocket(socket.id);
    if (!found || found.room.drawerId !== found.player.id || found.room.phase !== "drawing") {
      return;
    }
    found.room.strokes.pop();
    found.room.activeStroke = null;
    io.to(found.room.code).emit("canvas_state", found.room.strokes);
  });

  socket.on("canvas_clear", () => {
    if (!socketLimiter.allow(socket.id, "draw_action", 25, 1_000)) return;
    const found = findMemberBySocket(socket.id);
    if (!found || found.room.drawerId !== found.player.id || found.room.phase !== "drawing") {
      return;
    }
    found.room.strokes = [];
    found.room.activeStroke = null;
    io.to(found.room.code).emit("canvas_state", []);
  });
}
