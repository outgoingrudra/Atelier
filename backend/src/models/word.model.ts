import mongoose from "mongoose";

const wordSchema = new mongoose.Schema({
  text: { type: String, unique: true, required: true },
  category: { type: String, default: "general" },
});

export const WordModel = mongoose.models.Word || mongoose.model("Word", wordSchema);
