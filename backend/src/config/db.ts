import mongoose from "mongoose";
import { config } from "./env.js";

export async function connectDatabase(): Promise<boolean> {
  if (!config.mongodbUri) {
    console.log("MONGODB_URI is unset; using built-in words and skipping match history.");
    return false;
  }

  try {
    await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 5000 , dbName:"WordGame" });
    return true;
  } catch (error) {
    console.error("MongoDB unavailable; using built-in words:", error);
    return false;
  }
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
