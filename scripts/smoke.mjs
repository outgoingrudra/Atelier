import assert from "node:assert/strict";
import { io } from "socket.io-client";

if (process.env.SELF_HOST === "1") {
  await import("../backend/dist/index.js");
  await new Promise(resolve => setTimeout(resolve, 500));
}
const url = process.env.SOCKET_URL || "http://127.0.0.1:4000";
const host = io(url, { transports: ["websocket"] });
const guest = io(url, { transports: ["websocket"] });
host.on("connect_error", error => console.error("Host connection:", error.message));
guest.on("connect_error", error => console.error("Guest connection:", error.message));
const wait = (socket, event, timeout = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timed out waiting for ${event}`)); }, timeout);
  const handler = value => { clearTimeout(timer); resolve(value); };
  socket.once(event, handler);
});
const waitFor = (socket, event, predicate, timeout = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timed out waiting for ${event} condition`)); }, timeout);
  const handler = value => { if (!predicate(value)) return; clearTimeout(timer); socket.off(event, handler); resolve(value); };
  socket.on(event, handler);
});
const ack = (socket, event, payload) => new Promise((resolve, reject) => socket.timeout(5000).emit(event, payload, (error, value) => error ? reject(error) : resolve(value)));

try {
  await Promise.all([wait(host, "connect"), wait(guest, "connect")]);
  const created = await ack(host, "create_room", { name: "Artist", settings: { rounds: 2, drawTime: 15, wordCount: 3, hints: 1, maxPlayers: 4 } });
  assert.equal(created.ok, true);
  const joined = await ack(guest, "join_room", { code: created.code, name: "Guesser" });
  assert.equal(joined.ok, true);
  const optionsPromise = wait(host, "word_options");
  host.emit("start_game");
  const options = await optionsPromise;
  assert.equal(options.length, 3);
  const wordPromise = wait(host, "your_word");
  const drawingPromise = waitFor(guest, "room_state", value => value.phase === "drawing");
  host.emit("word_chosen", options[0]);
  assert.equal(await wordPromise, options[0]);
  const drawing = await drawingPromise;
  assert.equal(drawing.phase, "drawing");
  assert.equal(drawing.resultWord, null);
  const strokePromise = wait(guest, "draw_start");
  host.emit("draw_start", { id: "test-stroke", x: 0.1, y: 0.2, color: "#25221f", size: 7, tool: "pen" });
  assert.equal((await strokePromise).id, "test-stroke");
  host.emit("draw_move", { id: "test-stroke", x: 0.2, y: 0.3 });
  host.emit("draw_end", { id: "test-stroke" });
  const feedbackPromise = wait(guest, "guess_feedback");
  guest.emit("guess", ` ${options[0].toUpperCase()} `);
  const feedback = await feedbackPromise;
  assert.equal(feedback.correct, true);
  assert.ok(feedback.points >= 100);
  for (let turn = 2; turn <= 4; turn++) {
    const drawer = turn % 2 === 0 ? guest : host;
    const guesser = turn % 2 === 0 ? host : guest;
    const nextOptions = await wait(drawer, "word_options", 7000);
    const nextDrawing = waitFor(guesser, "room_state", state => state.phase === "drawing" && state.turn === turn);
    drawer.emit("word_chosen", nextOptions[0]);
    await nextDrawing;
    const nextFeedback = wait(guesser, "guess_feedback");
    guesser.emit("guess", nextOptions[0]);
    assert.equal((await nextFeedback).correct, true);
  }
  const finished = await waitFor(host, "room_state", state => state.phase === "finished", 7000);
  assert.equal(finished.turn, 4);
  assert.equal(finished.players.length, 2);
  console.log("PASS: create, join, word privacy, drawing sync, scoring, turn rotation, game finish");
} finally {
  host.disconnect(); guest.disconnect();
  if (process.env.SELF_HOST === "1") setTimeout(() => process.exit(), 100);
}
