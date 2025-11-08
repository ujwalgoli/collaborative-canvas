/**
 * client/canvas.js
 * ---------------------------------------------------------
 * Handles all drawing-related operations on the HTML canvas.
 * ---------------------------------------------------------
 * Responsibilities:
 * - Mouse/touch input capture
 * - Drawing brush and eraser strokes
 * - Color and size customization
 * - Applying remote operations from other users
 * - Undo/Redo via redraw from opLog
 */

const canvas = document.getElementById("draw-area");
const ctx = canvas.getContext("2d");

// Keep canvas full screen inside main area
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Drawing state
let drawing = false;
let currentTool = "brush";
let currentColor = "#000000";
let currentSize = 4;
let currentStroke = [];
let opLog = []; // local record of ops for replay

// External hooks (set by main.js)
let onStrokeSend = null;

// Setters for external control
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

// -------------------------
// Mouse / Touch Handling
// -------------------------
canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mouseout", endDraw);

// Touch support
canvas.addEventListener("touchstart", (e) => startDraw(e.touches[0]));
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  draw(e.touches[0]);
});
canvas.addEventListener("touchend", endDraw);

function startDraw(e) {
  drawing = true;
  currentStroke = [{ x: e.offsetX, y: e.offsetY }];
  drawPoint(e.offsetX, e.offsetY);

  // Send stroke start event
  if (onStrokeSend) {
    onStrokeSend({
      type: "stroke_start",
      tool: currentTool,
      color: currentColor,
      size: currentSize,
      start: { x: e.offsetX, y: e.offsetY },
      opId: generateId(),
    });
  }
}

function draw(e) {
  if (!drawing) return;
  const point = { x: e.offsetX, y: e.offsetY };
  const lastPoint = currentStroke[currentStroke.length - 1];
  drawLine(lastPoint, point);
  currentStroke.push(point);

  if (onStrokeSend) {
    onStrokeSend({
      type: "stroke_move",
      points: [point],
      color: currentColor,
      size: currentSize,
      tool: currentTool,
    });
  }
}

function endDraw() {
  if (!drawing) return;
  drawing = false;

  if (onStrokeSend) {
    onStrokeSend({
      type: "stroke_end",
      points: currentStroke,
      color: currentColor,
      size: currentSize,
      tool: currentTool,
    });
  }

  opLog.push({
    type: "stroke",
    color: currentColor,
    size: currentSize,
    tool: currentTool,
    points: currentStroke.slice(),
  });
  currentStroke = [];
}

// -------------------------
// Drawing Helpers
// -------------------------
function drawLine(p1, p2) {
  ctx.strokeStyle = currentTool === "eraser" ? "#FFFFFF" : currentColor;
  ctx.lineWidth = currentSize;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function drawPoint(x, y) {
  ctx.fillStyle = currentTool === "eraser" ? "#FFFFFF" : currentColor;
  ctx.beginPath();
  ctx.arc(x, y, currentSize / 2, 0, Math.PI * 2);
  ctx.fill();
}

export function applyOp(op) {
  if (
    op.type === "stroke_start" ||
    op.type === "stroke_move" ||
    op.type === "stroke_end"
  ) {
    drawStroke(op);
  } else if (op.type === "undo" || op.type === "redo") {
    replayCanvas(opLog);
  }
}

function drawStroke(op) {
  const points = op.points || [];
  if (points.length < 1) return;
  ctx.strokeStyle = op.tool === "eraser" ? "#FFFFFF" : op.color;
  ctx.lineWidth = op.size;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // Save to opLog for replay
  opLog.push(op);
}

export function replayCanvas(log) {
  clearCanvas();
  for (const op of log) {
    if (!op.undone) drawStroke(op);
  }
}

export function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// -------------------------
// Utility
// -------------------------
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}
