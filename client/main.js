/**
 * client/main.js
 * ---------------------------------------------------------
 * App entry point — integrates UI, canvas, and WebSocket layers.
 * ---------------------------------------------------------
 * Responsibilities:
 * - Manage toolbar UI and inputs
 * - Bridge canvas events <-> WebSocket events
 * - Display online users and cursor positions
 */

import {
  setTool,
  setColor,
  setSize,
  registerStrokeHandler,
  applyOp,
  clearCanvas,
} from "./canvas.js";

import {
  sendDrawingEvent,
  sendUndo,
  sendRedo,
  sendCursor,
  registerUserListHandler,
  registerCursorHandler,
} from "./websocket.js";

// -------------------------
// UI Element References
// -------------------------
const brushBtn = document.getElementById("brush");
const eraserBtn = document.getElementById("eraser");
const colorPicker = document.getElementById("color");
const sizeSlider = document.getElementById("size");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const userList = document.getElementById("user-list");
const canvas = document.getElementById("draw-area");
const ctx = canvas.getContext("2d");

// -------------------------
// Toolbar Functionality
// -------------------------
brushBtn.addEventListener("click", () => activateTool("brush"));
eraserBtn.addEventListener("click", () => activateTool("eraser"));

colorPicker.addEventListener("change", (e) => setColor(e.target.value));
sizeSlider.addEventListener("input", (e) => setSize(e.target.value));

undoBtn.addEventListener("click", () => sendUndo());
redoBtn.addEventListener("click", () => sendRedo());

function activateTool(tool) {
  setTool(tool);
  [brushBtn, eraserBtn].forEach((btn) => btn.classList.remove("active"));
  document.getElementById(tool).classList.add("active");
}

// -------------------------
// Canvas <-> WebSocket Bridge
// -------------------------
registerStrokeHandler((event) => {
  sendDrawingEvent(event);
});

// Mouse movement tracking for cursor sync
canvas.addEventListener("mousemove", (e) => {
  sendCursor(e.offsetX, e.offsetY);
});

// -------------------------
// Online User List Handling
// -------------------------
registerUserListHandler((users) => {
  userList.innerHTML = "";
  users.forEach(({ name }) => {
    const li = document.createElement("li");
    li.textContent = name;
    userList.appendChild(li);
  });
});

// -------------------------
// Remote Cursor Rendering (optional visual indicator)
// -------------------------
registerCursorHandler((userId, x, y) => {
  // Simple cursor visualization (optional)
  const size = 6;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 120, 255, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  // Cursor marks fade automatically when next frame repaints
});

// -------------------------
// Initialization Log
// -------------------------
console.log("🧩 Main app initialized - UI linked successfully");
