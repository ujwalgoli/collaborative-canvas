/**
 * server/drawing-state.js
 * ---------------------------------------------------------
 * Maintains canvas operation logs and synchronizes drawing
 * states across all clients in a room.
 * ---------------------------------------------------------
 * Responsibilities:
 * - Maintain operation log (opLog) for each room
 * - Handle drawing, undo, redo events
 * - Broadcast new ops to all clients
 * - Provide current state when new clients join
 */

// In-memory state for all rooms
const roomStates = {}; // { roomId: { opLog: [], nextSeq: number } }

/**
 * Get or create a room's drawing state
 * @param {string} roomId
 * @returns {object} roomState
 */
function getOrCreateRoomState(roomId) {
  if (!roomStates[roomId]) {
    roomStates[roomId] = {
      opLog: [],
      nextSeq: 1,
    };
    console.log(`🆕 Drawing state created for room ${roomId}`);
  }
  return roomStates[roomId];
}

/**
 * Handle any drawing-related event
 * @param {string} roomId
 * @param {object} event
 * @param {Server} io - socket.io server instance
 */
function handleDrawingEvent(roomId, event, io) {
  const state = getOrCreateRoomState(roomId);
  const seq = state.nextSeq++;

  const op = {
    seq,
    ...event,
    timestamp: Date.now(),
  };

  // Add to operation log
  state.opLog.push(op);

  // Handle undo/redo logic
  if (event.type === "undo" || event.type === "redo") {
    applyUndoRedo(state, event);
  }

  // Broadcast op to all users in the room
  io.to(roomId).emit("op", { seq, op });
}

/**
 * Apply undo or redo to opLog (marks target ops)
 * @param {object} state
 * @param {object} event
 */
function applyUndoRedo(state, event) {
  const { type, targetOpId } = event;
  if (!targetOpId) return;

  // Find target op in opLog
  const targetIndex = state.opLog.findIndex((op) => op.opId === targetOpId);
  if (targetIndex === -1) return;

  if (type === "undo") {
    state.opLog[targetIndex].undone = true;
  } else if (type === "redo") {
    state.opLog[targetIndex].undone = false;
  }

  console.log(`↩️ ${type.toUpperCase()} applied to op ${targetOpId}`);
}

/**
 * Get current canvas state when a new user joins
 * @param {string} roomId
 * @returns {object}
 */
function getCanvasState(roomId) {
  const state = getOrCreateRoomState(roomId);
  // Return latest snapshot + opLog tail
  return {
    type: "room_state",
    snapshot: null, // placeholder (snapshotting optional)
    opLogTail: state.opLog.slice(-500), // last 500 ops only
    lastSeq: state.nextSeq - 1,
  };
}

/**
 * Reset or clear a room (if needed)
 * @param {string} roomId
 */
function clearRoomState(roomId) {
  delete roomStates[roomId];
  console.log(`🧹 Cleared drawing state for room ${roomId}`);
}

// Exports
module.exports = {
  handleDrawingEvent,
  getCanvasState,
  clearRoomState,
};
