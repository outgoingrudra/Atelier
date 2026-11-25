import { connectDatabase } from "../config/db.js";
import { WordModel } from "../models/word.model.js";
import type { WordCategory } from "../types/protocol.js";

type WordEntry = { text: string; category: Exclude<WordCategory, "all"> };

const SEED_ENTRIES: WordEntry[] = [
  // animals
  { text: "butterfly", category: "animals" },
  { text: "cat", category: "animals" },
  { text: "dinosaur", category: "animals" },
  { text: "dog", category: "animals" },
  { text: "dolphin", category: "animals" },
  { text: "dragon", category: "animals" },
  { text: "elephant", category: "animals" },
  { text: "jellyfish", category: "animals" },
  { text: "kangaroo", category: "animals" },
  { text: "lion", category: "animals" },
  { text: "octopus", category: "animals" },
  { text: "penguin", category: "animals" },
  { text: "shark", category: "animals" },
  { text: "spider", category: "animals" },
  { text: "starfish", category: "animals" },
  { text: "tiger", category: "animals" },
  { text: "whale", category: "animals" },
  { text: "zebra", category: "animals" },
  // food
  { text: "apple", category: "food" },
  { text: "banana", category: "food" },
  { text: "birthday cake", category: "food" },
  { text: "cheese", category: "food" },
  { text: "coffee cup", category: "food" },
  { text: "hamburger", category: "food" },
  { text: "ice cream", category: "food" },
  { text: "mushroom", category: "food" },
  { text: "pizza", category: "food" },
  { text: "strawberry", category: "food" },
  { text: "watermelon", category: "food" },
  // nature
  { text: "cloud", category: "nature" },
  { text: "fireworks", category: "nature" },
  { text: "flower", category: "nature" },
  { text: "forest", category: "nature" },
  { text: "island", category: "nature" },
  { text: "moon", category: "nature" },
  { text: "mountain", category: "nature" },
  { text: "palm tree", category: "nature" },
  { text: "planet", category: "nature" },
  { text: "rainbow", category: "nature" },
  { text: "sunflower", category: "nature" },
  { text: "volcano", category: "nature" },
  // objects
  { text: "airplane", category: "objects" },
  { text: "anchor", category: "objects" },
  { text: "astronaut", category: "objects" },
  { text: "backpack", category: "objects" },
  { text: "balloon", category: "objects" },
  { text: "bicycle", category: "objects" },
  { text: "binoculars", category: "objects" },
  { text: "book", category: "objects" },
  { text: "bridge", category: "objects" },
  { text: "camera", category: "objects" },
  { text: "candle", category: "objects" },
  { text: "castle", category: "objects" },
  { text: "clock", category: "objects" },
  { text: "compass", category: "objects" },
  { text: "crown", category: "objects" },
  { text: "drum", category: "objects" },
  { text: "football", category: "objects" },
  { text: "guitar", category: "objects" },
  { text: "headphones", category: "objects" },
  { text: "helicopter", category: "objects" },
  { text: "key", category: "objects" },
  { text: "kite", category: "objects" },
  { text: "ladder", category: "objects" },
  { text: "lighthouse", category: "objects" },
  { text: "paintbrush", category: "objects" },
  { text: "piano", category: "objects" },
  { text: "robot", category: "objects" },
  { text: "rocket", category: "objects" },
  { text: "sailboat", category: "objects" },
  { text: "sandcastle", category: "objects" },
  { text: "scissors", category: "objects" },
  { text: "skateboard", category: "objects" },
  { text: "snowman", category: "objects" },
  { text: "spaceship", category: "objects" },
  { text: "sunglasses", category: "objects" },
  { text: "telescope", category: "objects" },
  { text: "tent", category: "objects" },
  { text: "toothbrush", category: "objects" },
  { text: "train", category: "objects" },
  { text: "treasure chest", category: "objects" },
  { text: "treehouse", category: "objects" },
  { text: "umbrella", category: "objects" },
  { text: "windmill", category: "objects" },
  { text: "wizard", category: "objects" },
];

let wordCache: { text: string; category: string }[] = SEED_ENTRIES;

export async function initWords(): Promise<void> {
  const connected = await connectDatabase();
  if (!connected) return;

  try {
    await WordModel.bulkWrite(
      SEED_ENTRIES.map(({ text, category }) => ({
        updateOne: {
          filter: { text },
          update: { $set: { category }, $setOnInsert: { text } },
          upsert: true,
        },
      }))
    );
    const records = await WordModel.find({}, { text: 1, category: 1, _id: 0 }).lean<
      { text?: string; category?: string }[]
    >();
    const loaded = records
      .filter((record): record is { text: string; category?: string } => Boolean(record.text))
      .map((record) => ({ text: record.text, category: record.category || "objects" }));
    if (loaded.length > 0) {
      wordCache = loaded;
    }
    console.log(`MongoDB connected; ${wordCache.length} words available.`);
  } catch (error) {
    console.error("MongoDB word sync failed; using built-in words:", error);
  }
}

export function getWords(
  count: number,
  category: WordCategory = "all"
): string[] {
  const pool =
    category === "all"
      ? wordCache.map((w) => w.text)
      : wordCache.filter((w) => w.category === category).map((w) => w.text);

  const source = pool.length >= count ? pool : wordCache.map((w) => w.text);
  return [...source].sort(() => Math.random() - 0.5).slice(0, count);
}
