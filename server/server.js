/**
 * server/server.js
 * ---------------------------------------------------------
 * Main backend entry point for Collaborative Canvas Project
 * ---------------------------------------------------------
 * Responsibilities:
 * - Serve static files from /client
 * - Initialize Socket.IO for real-time connections
 * - Manage rooms and drawing events
 * - Connect to rooms.js and drawing-state.js modules
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const { getRoom, createRoom, removeUserFromRoom } = require("./rooms");
const { handleDrawingEvent, getCanvasState } = require("./drawing-state");

// -------------------------
// Server Initialization
// -------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve client files
const clientPath = path.join(__dirname, "..", "client");
app.use(express.static(clientPath));

// Default route
app.get("/", (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

// -------------------------
// Socket.IO Real-time Layer
// -------------------------
io.on("connection", (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  // User joins a room
  socket.on("join_room", ({ roomId, userId, displayName }) => {
    console.log(`👥 ${displayName || userId} joined room: ${roomId}`);

    // Create room if not exists
    const room = getRoom(roomId) || createRoom(roomId);
    room.users[socket.id] = { userId, displayName };

    socket.join(roomId);

    // Send current state (snapshot + opLog tail)
    const state = getCanvasState(roomId);
    socket.emit("room_state", state);

    // Notify others
    socket.to(roomId).emit("user_joined", { userId, displayName });
  });

  // Handle drawing events
  socket.on("drawing_event", ({ roomId, event }) => {
    handleDrawingEvent(roomId, event, io);
  });

  // Handle cursor movement
  socket.on("cursor", ({ roomId, userId, x, y }) => {
    socket.to(roomId).emit("cursor_update", { userId, x, y });
  });

  // Handle undo/redo
  socket.on("undo", ({ roomId, userId, targetOpId }) => {
    handleDrawingEvent(roomId, { type: "undo", userId, targetOpId }, io);
  });

  socket.on("redo", ({ roomId, userId, targetOpId }) => {
    handleDrawingEvent(roomId, { type: "redo", userId, targetOpId }, io);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
    const roomId = removeUserFromRoom(socket.id);
    if (roomId) {
      socket.to(roomId).emit("user_left", { socketId: socket.id });
    }
  });
});

// -------------------------
// Start server
// -------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Collaborative Canvas server running on http://localhost:${PORT}`);
});
