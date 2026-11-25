import type { TypedServer } from "./broadcast.js";
import { registerDrawHandlers } from "./drawHandlers.js";
import { registerGameHandlers } from "./gameHandlers.js";
import { registerRoomHandlers } from "./roomHandlers.js";

export function registerSocketHandlers(io: TypedServer): void {
  io.on("connection", (socket) => {
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerDrawHandlers(io, socket);
  });
}
