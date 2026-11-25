import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, rooms, toRoomState } from '../backend/dist/services/roomService.js';
import { startGame, startTurn, clearTimers, handleGuess, endTurn } from '../backend/dist/services/gameService.js';
import { registerGameHandlers } from '../backend/dist/socket/gameHandlers.js';
import { registerDrawHandlers } from '../backend/dist/socket/drawHandlers.js';
import { computeHint } from '../backend/dist/services/scoringService.js';
import { settingsFrom } from '../backend/dist/utils/sanitize.js';

const sent = [];
const io = { to: target => ({ emit: (event, value) => sent.push({ target, event, value }) }) };
test('malformed numeric settings cannot throw during socket handling', () => {
  assert.doesNotThrow(() => settingsFrom({ maxPlayers: { toString: null, valueOf: null } }));
});
function setup(count = 3) {
  const { room, player } = createRoom('A', 'socket-A', { rounds: 2 });
  for (let i = 1; i < count; i++) room.members.push({ ...player, id: `player-${i}`, name: String(i), socketId: `socket-${i}`, resumeToken: `token-${i}`, ready: true });
  return room;
}
afterEach(() => { for (const room of rooms.values()) { clearTimers(room); if (room.cleanupTimer) clearTimeout(room.cleanupTimer); } rooms.clear(); sent.length = 0; });

test('turn order and round count remain stable when a middle player disconnects', () => {
  const room = setup(); startGame(io, room);
  assert.equal(room.drawerId, room.members[0].id);
  room.members[1].connected = false;
  startTurn(io, room);
  assert.equal(room.drawerId, room.members[2].id);
  assert.equal(room.round, 1);
  startTurn(io, room);
  assert.equal(room.drawerId, room.members[0].id);
  assert.equal(room.round, 2);
});

test('expired guesses cannot earn points between timer ticks', () => {
  const room = setup(2); startGame(io, room);
  room.phase = 'drawing'; room.word = 'cat'; room.deadline = Date.now() - 1;
  handleGuess(io, { emit() {} }, room, room.members[1], 'cat');
  assert.equal(room.members[1].score, 0);
  assert.equal(room.phase, 'result');
});

test('readiness and host permissions are enforced on the server', () => {
  const room = setup(2); room.members[1].ready = false;
  const handlers = {};
  registerGameHandlers(io, { id: room.members[0].socketId, on: (event, fn) => handlers[event] = fn });
  handlers.start_game(); assert.equal(room.phase, 'lobby');
  room.members[1].ready = true;
  handlers.start_game(); assert.equal(room.phase, 'choosing');
});

test('partial strokes survive snapshots and turn completion without revealing the word', () => {
  const room = setup(2); startGame(io, room);
  room.phase = 'drawing'; room.word = 'cat';
  room.activeStroke = { id: 'partial', color: '#000000', size: 7, tool: 'pen', points: [{ x: .2, y: .3 }] };
  assert.equal(toRoomState(room).strokes[0].id, 'partial');
  assert.equal(toRoomState(room).resultWord, null);
  assert.equal('options' in toRoomState(room), false);
  endTurn(io, room);
  assert.equal(room.strokes[0].id, 'partial');
});

test('stroke completion remains accepted after the start-event rate limit is exhausted', () => {
  const room = setup(2); startGame(io, room); room.phase = 'drawing';
  const handlers = {};
  registerDrawHandlers(io, { id: room.members[0].socketId, on: (event, fn) => handlers[event] = fn, to: io.to });
  for (let i = 0; i < 25; i++) handlers.draw_start({ id: `stroke-${i}`, x: .1, y: .1 });
  handlers.draw_end({ id: 'stroke-24', points: Array.from({ length: 1200 }, () => ({ x: .2, y: .2 })) });
  assert.equal(room.activeStroke, null);
  assert.equal(room.strokes.at(-1).points.length, 1000);
});

test('hints never reveal the entire word or spend hints on spaces', () => {
  const room = setup();
  const hint = computeHint('a b', 1, { ...room.settings, hints: 5 }, Date.now() - 1);
  assert.equal((hint.match(/_/g) || []).length, 1);
});
