import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { config, socketCorsOptions } from "./config/env.js";
import { createHttpRateLimiter } from "./middleware/rateLimit.js";
import { getRoomCount } from "./services/roomService.js";
import { initWords } from "./services/wordService.js";
import { registerSocketHandlers } from "./socket/index.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./types/protocol.js";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));
app.use(createHttpRateLimiter(60, 60_000));
app.get("/health", (_req, res) => {
  res.json({ ok: true, rooms: getRoomCount() });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: socketCorsOptions,
  transports: ["websocket", "polling"],
  maxHttpBufferSize: config.maxHttpBufferSize,
});

registerSocketHandlers(io);

void initWords();
httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`Game server listening on ${config.port}`);
});
