/**
 * client/canvas.js
 * ---------------------------------------------------------
 * Handles all canvas drawing operations.
 * Implements real-time drawing, undo/redo, stroke replay,
 * and smooth rendering for multiple users.
 *
 * No frameworks, no libraries — pure Canvas API.
 */

const canvas = document.getElementById("draw-area");
const ctx = canvas.getContext("2d");

// -------------------------
// Canvas setup
// -------------------------
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  redrawAll();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// -------------------------
// Drawing state variables
// -------------------------
let drawing = false;
let currentTool = "brush";
let currentColor = "#000000";
let currentSize = 4;

// Store current stroke being drawn
let currentStroke = [];

// Authoritative operation log for replay (mirrors server ops)
const opLog = [];

// External callback — set by main.js to send strokes to server
let onStrokeSend = null;

// -------------------------
// Public API functions (imported by main.js)
// -------------------------
export function setTool(tool) {
  currentTool = tool;
}

export function setColor(color) {
  currentColor = color;
}

export function setSize(size) {
  currentSize = parseInt(size, 10);
}

export function registerStrokeHandler(handler) {
  onStrokeSend = handler;
}

// Called by websocket.js for remote ops
export function applyOp(op) {
  if (!op || op.undone) return;

  if (op.type.startsWith("stroke")) {
    drawStrokeOp(op);
    pushOp(op);
  } else if (op.type === "undo" || op.type === "redo") {
    // Redraw entire opLog for global consistency
    redrawAll();
  }
}

// Rebuild entire canvas based on opLog (used on undo/redo or join)
export function replayCanvas(log) {
  opLog.length = 0;
  opLog.push(...log);
  redrawAll();
}

// Clear entire canvas
export function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// -------------------------
// Local drawing event handlers
// -------------------------
canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mouseleave", endDraw);

// Touch events (mobile)
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  startDraw({
    offsetX: t.clientX - canvas.offsetLeft,
    offsetY: t.clientY - canvas.offsetTop,
  });
});
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  draw({
    offsetX: t.clientX - canvas.offsetLeft,
    offsetY: t.clientY - canvas.offsetTop,
  });
});
canvas.addEventListener("touchend", endDraw);

function startDraw(e) {
  drawing = true;
  currentStroke = [{ x: e.offsetX, y: e.offsetY }];
  drawDot(e.offsetX, e.offsetY);

  const startOp = {
    type: "stroke_start",
    opId: generateId(),
    userId: null, // filled by websocket.js
    tool: currentTool,
    color: currentColor,
    size: currentSize,
    start: { x: e.offsetX, y: e.offsetY },
  };

  if (onStrokeSend) onStrokeSend(startOp);
}

function draw(e) {
  if (!drawing) return;
  const point = { x: e.offsetX, y: e.offsetY };
  const last = currentStroke[currentStroke.length - 1];
  drawLine(last, point, currentTool, currentColor, currentSize);
  currentStroke.push(point);

  const moveOp = {
    type: "stroke_move",
    opId: currentStroke.opId,
    points: [point],
    color: currentColor,
    size: currentSize,
    tool: currentTool,
  };
  if (onStrokeSend) onStrokeSend(moveOp);
}

function endDraw() {
  if (!drawing) return;
  drawing = false;

  const endOp = {
    type: "stroke_end",
    opId: currentStroke.opId,
    points: currentStroke.slice(),
    color: currentColor,
    size: currentSize,
    tool: currentTool,
  };
  if (onStrokeSend) onStrokeSend(endOp);

  // Save stroke locally for undo/redo replay
  pushOp({
    ...endOp,
    userId: null,
  });

  currentStroke = [];
}

// -------------------------
// Drawing helpers
// -------------------------
function drawLine(p1, p2, tool, color, size) {
  ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function drawDot(x, y) {
  ctx.fillStyle = currentTool === "eraser" ? "#FFFFFF" : currentColor;
  ctx.beginPath();
  ctx.arc(x, y, currentSize / 2, 0, Math.PI * 2);
  ctx.fill();
}

// Apply a stroke operation received from server
function drawStrokeOp(op) {
  if (!op.points || op.points.length < 1) return;

  const points = op.points;
  ctx.strokeStyle = op.tool === "eraser" ? "#FFFFFF" : op.color;
  ctx.lineWidth = op.size;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

// Redraw the entire opLog (skipping undone ops)
function redrawAll() {
  clearCanvas();
  for (const op of opLog) {
    if (!op.undone && op.type.startsWith("stroke")) {
      drawStrokeOp(op);
    }
  }
}

// -------------------------
// Utility
// -------------------------
function pushOp(op) {
  // Avoid duplicates (check opId and seq)
  if (!opLog.find((o) => o.opId === op.opId && o.type === op.type)) {
    opLog.push(op);
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}
