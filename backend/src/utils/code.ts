import { randomBytes } from "node:crypto";

export function generateRoomCode(existingCodes: Set<string> | Map<string, unknown>): string {
  let value: string;
  do {
    value = randomBytes(3).toString("hex").toUpperCase();
  } while (existingCodes.has(value));
  return value;
}
