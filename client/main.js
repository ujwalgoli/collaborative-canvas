/**
 * client/main.js
 * ---------------------------------------------------------
 * Integrates UI, canvas, and websocket layers.
 * Handles toolbar input, user list, cursor indicators,
 * and real-time collaboration setup.
 */

import { setTool, setColor, setSize, registerStrokeHandler } from "./canvas.js";

import {
  sendDrawingEvent,
  sendUndo,
  sendRedo,
  sendCursor,
  registerUserListHandler,
  registerCursorHandler,
} from "./websocket.js";

// -------------------------
// UI ELEMENTS
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

// Assign colors to users deterministically
const userColors = {};
function assignColorToUser(userId) {
  if (!userColors[userId]) {
    const hue = Math.floor(Math.random() * 360);
    userColors[userId] = `hsl(${hue}, 80%, 50%)`;
  }
  return userColors[userId];
}

// -------------------------
// TOOLBAR HANDLING
// -------------------------
brushBtn.addEventListener("click", () => activateTool("brush"));
eraserBtn.addEventListener("click", () => activateTool("eraser"));
colorPicker.addEventListener("change", (e) => setColor(e.target.value));
sizeSlider.addEventListener("input", (e) => setSize(e.target.value));

undoBtn.addEventListener("click", () => {
  sendUndo();
});
redoBtn.addEventListener("click", () => {
  sendRedo();
});

function activateTool(tool) {
  setTool(tool);
  [brushBtn, eraserBtn].forEach((b) => b.classList.remove("active"));
  document.getElementById(tool).classList.add("active");
}

// -------------------------
// CANVAS ↔️ WEBSOCKET BRIDGE
// -------------------------
registerStrokeHandler((event) => {
  sendDrawingEvent(event);
});

canvas.addEventListener("mousemove", (e) => {
  sendCursor(e.offsetX, e.offsetY);
});

// -------------------------
// ONLINE USER LIST
// -------------------------
registerUserListHandler((users) => {
  userList.innerHTML = "";
  users.forEach(({ id, name }) => {
    const li = document.createElement("li");
    li.textContent = name;
    li.style.color = assignColorToUser(id);
    userList.appendChild(li);
  });
});

// -------------------------
// REMOTE CURSOR INDICATORS
// -------------------------
const cursors = {}; // userId → {x, y, color, fadeTimeout}

registerCursorHandler((userId, x, y) => {
  if (!userId) return;

  // Assign each remote user a consistent color
  const color = assignColorToUser(userId);

  // Draw a temporary cursor marker
  const size = 6;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.restore();

  // Fade marker after short delay to prevent buildup
  clearTimeout(cursors[userId]?.fadeTimeout);
  cursors[userId] = {
    x,
    y,
    color,
    fadeTimeout: setTimeout(() => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, size + 1, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 8;
      ctx.globalAlpha = 1;
      ctx.stroke();
      ctx.restore();
    }, 300),
  };
});

// -------------------------
// USER EXPERIENCE TOUCHUPS
// -------------------------
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    sendUndo();
  } else if (e.ctrlKey && e.key === "y") {
    sendRedo();
  }
});

console.log("✅ Main app initialized - Collaborative Canvas ready");
