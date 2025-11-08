/**
 * client/websocket.js
 * ---------------------------------------------------------
 * Manages WebSocket (Socket.IO) connection and communication
 * for the Collaborative Canvas project.
 * ---------------------------------------------------------
 * Responsibilities:
 * - Connect to server and join room
 * - Transmit local drawing, cursor, undo/redo events
 * - Receive remote operations and apply them to canvas
 * - Handle user join/leave updates
 */

import { applyOp, replayCanvas } from "./canvas.js";

const socket = io(); // auto-connects to same host
let userId = generateId();
let roomId = "default-room"; // single shared room
let displayName = `User-${userId.slice(0, 4)}`;

let onUserListUpdate = null;
let onCursorUpdate = null;

// Store all active users
let users = {};

// -------------------------
// Connection & Room Join
// -------------------------
socket.on("connect", () => {
  console.log("✅ Connected to server:", socket.id);
  joinRoom(roomId);
});

function joinRoom(roomId) {
  socket.emit("join_room", { roomId, userId, displayName });
}

// -------------------------
// Drawing Event Handling
// -------------------------
export function sendDrawingEvent(event) {
  socket.emit("drawing_event", { roomId, event });
}

export function sendUndo(targetOpId) {
  socket.emit("undo", { roomId, userId, targetOpId });
}

export function sendRedo(targetOpId) {
  socket.emit("redo", { roomId, userId, targetOpId });
}

export function sendCursor(x, y) {
  socket.emit("cursor", { roomId, userId, x, y });
}

// -------------------------
// Incoming Server Events
// -------------------------

// Initial state when joining
socket.on("room_state", (state) => {
  console.log("📦 Received initial room state", state);
  replayCanvas(state.opLogTail || []);
});

// New operation broadcast
socket.on("op", ({ seq, op }) => {
  applyOp(op);
});

// Other user joined
socket.on("user_joined", ({ userId, displayName }) => {
  users[userId] = displayName;
  updateUserList();
  console.log(`👥 ${displayName} joined`);
});

// Other user left
socket.on("user_left", ({ socketId }) => {
  for (const [id, name] of Object.entries(users)) {
    if (id === socketId || id === socket.id) {
      delete users[id];
    }
  }
  updateUserList();
});

// Cursor movement from others
socket.on("cursor_update", ({ userId, x, y }) => {
  if (onCursorUpdate) onCursorUpdate(userId, x, y);
});

// -------------------------
// UI hooks registration
// -------------------------
export function registerUserListHandler(handler) {
  onUserListUpdate = handler;
}

export function registerCursorHandler(handler) {
  onCursorUpdate = handler;
}

function updateUserList() {
  if (onUserListUpdate) {
    onUserListUpdate(Object.entries(users).map(([id, name]) => ({ id, name })));
  }
}

// -------------------------
// Utility
// -------------------------
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

console.log("🧠 WebSocket module loaded");
