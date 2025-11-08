/**
 * server/server.js
 * ---------------------------------------------------------
 * Main server file for Collaborative Canvas.
 * Handles:
 *  - Serving client files
 *  - WebSocket events via Socket.IO
 *  - User join/leave management
 *  - Delegating drawing operations to drawing-state.js
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const { getRoom, createRoom, removeUserFromRoom } = require("./rooms");
const { handleDrawingEvent, getCanvasState } = require("./drawing-state");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// -------------------------
// Serve client files
// -------------------------
const clientPath = path.join(__dirname, "..", "client");
app.use(express.static(clientPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

// -------------------------
// Utility: generate short random id
// -------------------------
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// -------------------------
// WebSocket Event Handling
// -------------------------
io.on("connection", (socket) => {
  console.log(`🟢 User connected: socket ${socket.id}`);

  socket.on("join_room", ({ roomId, userId, displayName }) => {
    try {
      if (!roomId) roomId = "default-room";
      if (!userId) userId = generateId();

      const room = getRoom(roomId) || createRoom(roomId);
      room.users[socket.id] = { userId, displayName };

      socket.join(roomId);
      console.log(`👥 ${displayName || userId} joined ${roomId}`);

      // Send current canvas state to the new user
      const state = getCanvasState(roomId);
      socket.emit("room_state", state);

      // Notify all other users in the room
      socket.to(roomId).emit("user_joined", { userId, displayName });
    } catch (err) {
      console.error("❌ Error in join_room:", err);
    }
  });

  // Drawing events (brush, eraser, etc.)
  socket.on("drawing_event", ({ roomId, event }) => {
    try {
      handleDrawingEvent(roomId, event, io);
    } catch (err) {
      console.error("❌ Error in drawing_event:", err);
    }
  });

  // Cursor movement
  socket.on("cursor", ({ roomId, userId, x, y }) => {
    if (!roomId || !userId) return;
    socket.to(roomId).emit("cursor_update", { userId, x, y });
  });

  // Undo/Redo
  socket.on("undo", ({ roomId, userId, targetOpId }) => {
    try {
      handleDrawingEvent(roomId, { type: "undo", userId, targetOpId }, io);
    } catch (err) {
      console.error("❌ Error in undo:", err);
    }
  });

  socket.on("redo", ({ roomId, userId, targetOpId }) => {
    try {
      handleDrawingEvent(roomId, { type: "redo", userId, targetOpId }, io);
    } catch (err) {
      console.error("❌ Error in redo:", err);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const roomId = removeUserFromRoom(socket.id);
    if (roomId) {
      socket.to(roomId).emit("user_left", { userId: socket.id });
    }
    console.log(`🔴 Socket disconnected: ${socket.id}`);
  });
});

// -------------------------
// Start server
// -------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(
    `🚀 Collaborative Canvas server running on http://localhost:${PORT}`
  );
});
