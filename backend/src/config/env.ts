import dotenv from "dotenv";
import type { CorsOptions } from "cors";

dotenv.config({ path: ".env.local" });
dotenv.config();

const rawOrigins = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

export const config = {
  port: Number(process.env.PORT) || 4000,
  frontendOrigins: rawOrigins.split(",").map((origin) => origin.trim()).filter(Boolean),
  mongodbUri: process.env.MONGODB_URI || "",
  maxHttpBufferSize: 100_000,
} as const;

export const socketCorsOptions: CorsOptions = {
  origin: config.frontendOrigins,
  methods: ["GET", "POST"],
};
