/**
 * client/websocket.js
 * ---------------------------------------------------------
 * WebSocket (Socket.IO) client for Collaborative Canvas.
 * - Uses ES module exports/imports to integrate with canvas/main.
 * - Keeps a local opLog synced with server to support deterministic replay.
 *
 * Notes:
 * - This file intentionally includes concise comments explaining each block.
 * - No external libraries except the socket.io client script served by the server.
 */

import { applyOp, replayCanvas } from "./canvas.js"; // functions that draw/replay ops

// Connect to Socket.IO (served from server on same origin)
const socket = io(); // `io` is available because index.html loads /socket.io/socket.io.js

// Generate a simple client id for this browser session.
// Not cryptographically unique but fine for the demo.
const clientId = generateId();

// Logical room (single-room demo). You may expose UI later to change roomId.
let roomId = "default-room";

// Human-friendly display name (used in user list). Trim to keep UI tidy.
const displayName = `User-${clientId.slice(0, 4)}`;

// Local mirrors of server state
const clientOpLog = []; // ordered array of ops received/applied from server
const users = {}; // userId -> displayName mapping (for user list UI)

// Hooks that main.js can register to receive updates
let userListHandler = null;
let cursorHandler = null;

// Cursor send throttling state
let lastCursorSent = 0;
const CURSOR_THROTTLE_MS = 50; // send at most 20Hz

// -------------------------
// Connection & join
// -------------------------
socket.on("connect", () => {
  // Informative log for debugging
  console.log("WebSocket: connected as", socket.id, "clientId:", clientId);

  // Ask server to join the room with our clientId/displayName
  socket.emit("join_room", { roomId, userId: clientId, displayName });
});

// -------------------------
// Outgoing actions (called by canvas/main)
// -------------------------

/**
 * Send a drawing-related event to the server.
 * We attach our clientId and ensure opId exists before sending.
 * event: { type, opId?, points?, tool?, color?, size?, bbox?, ... }
 */
export function sendDrawingEvent(event) {
  // Ensure event has an opId for server and replay identification
  if (!event.opId) {
    event.opId = generateId();
  }

  // Attach our user id
  event.userId = clientId;

  // Emit a compact envelope so server can store and broadcast with seq
  socket.emit("drawing_event", { roomId, event });

  // Optionally: keep a lightweight pending record locally until server echoes it back.
  // We push a copy so modifications after sending don't affect the saved op.
  clientOpLog.push({ ...event, _local: true });
}

/**
 * Request global undo.
 * If targetOpId is omitted, server will resolve last applicable op for this user.
 */
export function sendUndo(targetOpId = null) {
  socket.emit("undo", { roomId, userId: clientId, targetOpId });
}

/**
 * Request global redo.
 */
export function sendRedo(targetOpId = null) {
  socket.emit("redo", { roomId, userId: clientId, targetOpId });
}

/**
 * Send cursor position (throttled)
 */
export function sendCursor(x, y) {
  const now = Date.now();
  if (now - lastCursorSent < CURSOR_THROTTLE_MS) return; // drop to limit frequency
  lastCursorSent = now;
  socket.emit("cursor", { roomId, userId: clientId, x, y });
}

// -------------------------
// Incoming server events
// -------------------------

/**
 * room_state:
 * - snapshot (optional)
 * - opLogTail: array of ops (authoritative, ordered)
 * - lastSeq: last assigned sequence on server
 *
 * When joining, we replace our local opLog with the server's tail and replay.
 */
socket.on("room_state", (state) => {
  console.log("WebSocket: received room_state", state);

  // Replace local opLog with server-provided tail for authoritative state
  const tail = Array.isArray(state.opLogTail) ? state.opLogTail : [];
  clientOpLog.length = 0; // clear
  tail.forEach((op) => clientOpLog.push(op));

  // Replay authoritative ops onto canvas (canvas.replay expects an array of ops)
  // We filter out undone ops inside replay implementation (canvas.replayCanvas).
  replayCanvas(clientOpLog);
});

/**
 * op:
 * The server broadcasts each canonical op as:
 * { seq, op }
 * We append to local opLog and call applyOp to render incremental changes.
 */
socket.on("op", ({ seq, op }) => {
  // Basic validation: must have seq and opId
  if (!op || typeof seq !== "number") {
    console.warn("WebSocket: invalid op packet", seq, op);
    return;
  }

  // Append op to local opLog (keeps same ordering as server)
  clientOpLog.push(op);

  // If op is an undo/redo marker, it's already applied to opLog (undone flag); we need to replay fully
  if (op.type === "undo" || op.type === "redo") {
    // Full replay ensures consistent deterministic state across clients
    replayCanvas(clientOpLog);
    return;
  }

  // For incremental stroke ops, apply directly for low-latency render
  applyOp(op);
});

/**
 * user_joined / user_left:
 * Server notifies when remote participants join/leave. Keep user map and notify UI.
 */
socket.on("user_joined", ({ userId, displayName }) => {
  // Add user when they join
  users[userId] = displayName || userId;
  notifyUserList();
});

socket.on("user_left", ({ socketId, userId }) => {
  // Server may send either socketId or userId; remove both defensively
  if (userId && users[userId]) delete users[userId];
  if (socketId && users[socketId]) delete users[socketId];
  notifyUserList();
});

/**
 * cursor_update: remote cursor positions
 * → forward to registered cursor handler (main.js may draw indicator)
 */
socket.on("cursor_update", ({ userId, x, y }) => {
  if (typeof cursorHandler === "function") {
    cursorHandler(userId, x, y);
  }
});

// -------------------------
// UI hooks registration
// -------------------------

/**
 * Register a handler that receives an array of users:
 * [{ id: 'abc', name: 'User-abc' }, ...]
 */
export function registerUserListHandler(handler) {
  userListHandler = handler;
  // Immediately notify with current users
  notifyUserList();
}

/**
 * Register a handler for remote cursor positions:
 * function(userId, x, y) { ... }
 */
export function registerCursorHandler(handler) {
  cursorHandler = handler;
}

// Notify UI about current users (map -> array)
function notifyUserList() {
  if (typeof userListHandler !== "function") return;
  const list = Object.entries(users).map(([id, name]) => ({ id, name }));
  // include ourselves in the list for clarity
  list.unshift({ id: clientId, name: displayName });
  userListHandler(list);
}

// -------------------------
// Utility helpers
// -------------------------

/** Short id generator */
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// Expose some internals for debugging (optional)
window.__collab_debug = window.__collab_debug || {};
window.__collab_debug.clientOpLog = clientOpLog;
window.__collab_debug.users = users;

console.log("WebSocket: module loaded, clientId:", clientId);
