/**
 * server/drawing-state.js
 * ---------------------------------------------------------
 * Maintains canvas operation logs and synchronizes drawing
 * states across all clients in a room.
 * ---------------------------------------------------------
 * Responsibilities:
 * - Maintain operation log (opLog) for each room
 * - Handle drawing, undo, redo events (including implicit undo/redo)
 * - Broadcast new ops to all clients (server emits in server/server.js)
 * - Provide current state when new clients join
 *
 * Notes:
 * - Each op stored in opLog will have a server-assigned `seq` and an `opId`.
 * - Stroke operations are additive. Undo/redo are recorded as ops referencing targetOpId.
 */

const roomStates = {}; // { roomId: { opLog: [], nextSeq: number } }

/** Utility: generate short unique id (not cryptographically strong) */
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Get or create a room's drawing state
 * @param {string} roomId
 * @returns {object} roomState
 */
function getOrCreateRoomState(roomId) {
  if (!roomStates[roomId]) {
    roomStates[roomId] = {
      opLog: [], // array of ops in authoritative order
      nextSeq: 1,
    };
    console.log(`🆕 Drawing state created for room ${roomId}`);
  }
  return roomStates[roomId];
}

/**
 * Append an op to room opLog with seq, ensure opId exists
 * @param {object} state
 * @param {object} opPayload
 * @returns {object} op (with seq and opId)
 */
function appendOp(state, opPayload) {
  const seq = state.nextSeq++;
  const opId = opPayload.opId || generateId();

  const op = {
    seq,
    opId,
    type: opPayload.type,
    userId: opPayload.userId || null,
    // optional fields: points, tool, color, size, bbox, targetOpId, etc
    points:
      opPayload.points || opPayload.points === null
        ? opPayload.points
        : undefined,
    tool: opPayload.tool,
    color: opPayload.color,
    size: opPayload.size,
    bbox: opPayload.bbox,
    targetOpId: opPayload.targetOpId || null,
    timestamp: Date.now(),
    undone: !!opPayload.undone, // default false
    raw: opPayload.raw || undefined, // reserved
  };

  state.opLog.push(op);
  return op;
}

/**
 * Handle any drawing-related event
 * @param {string} roomId
 * @param {object} event
 * @param {Server} io - socket.io server instance
 */
function handleDrawingEvent(roomId, event, io) {
  const state = getOrCreateRoomState(roomId);

  // Normalize incoming event type
  const type = event.type;

  if (type === "undo" || type === "redo") {
    // If targetOpId not specified, resolve last (or last undone) op by that user
    let targetOpId = event.targetOpId || null;

    if (!targetOpId && event.userId) {
      if (type === "undo") {
        // find last op by this user that is a stroke and not undone
        for (let i = state.opLog.length - 1; i >= 0; i--) {
          const cand = state.opLog[i];
          if (
            cand.userId === event.userId &&
            cand.type &&
            cand.type.startsWith("stroke") &&
            !cand.undone
          ) {
            targetOpId = cand.opId;
            break;
          }
        }
      } else if (type === "redo") {
        // find last op by this user that is a stroke and is undone
        for (let i = state.opLog.length - 1; i >= 0; i--) {
          const cand = state.opLog[i];
          if (
            cand.userId === event.userId &&
            cand.type &&
            cand.type.startsWith("stroke") &&
            cand.undone
          ) {
            targetOpId = cand.opId;
            break;
          }
        }
      }
    }

    // If no target found, still append a no-op undo (for audit) but log and return
    if (!targetOpId) {
      console.log(
        `⚠️ ${type.toUpperCase()} received but no target found for user ${
          event.userId
        }`
      );
      // Append a marker op so clients can see the attempt (optional)
      const marker = appendOp(state, {
        type,
        userId: event.userId,
        targetOpId: null,
      });
      // Broadcast marker op
      io.to(roomId).emit("op", { seq: marker.seq, op: marker });
      return;
    }

    // Apply undo/redo: mark target op's undone flag
    const targetIndex = state.opLog.findIndex((o) => o.opId === targetOpId);
    if (targetIndex === -1) {
      console.log(
        `⚠️ ${type.toUpperCase()} target opId not found: ${targetOpId}`
      );
      const marker = appendOp(state, {
        type,
        userId: event.userId,
        targetOpId,
      });
      io.to(roomId).emit("op", { seq: marker.seq, op: marker });
      return;
    }

    if (type === "undo") {
      state.opLog[targetIndex].undone = true;
    } else if (type === "redo") {
      state.opLog[targetIndex].undone = false;
    }

    // Append the undo/redo op itself to the log (so it is visible in the timeline)
    const undoOp = appendOp(state, {
      type,
      userId: event.userId,
      targetOpId,
    });

    // Broadcast the undo/redo op (clients may replay)
    io.to(roomId).emit("op", { seq: undoOp.seq, op: undoOp });
    console.log(
      `↩️ ${type.toUpperCase()} by ${event.userId} -> target ${targetOpId}`
    );
    return;
  }

  // For stroke-related events (stroke_start / stroke_move / stroke_end),
  // accept incoming payload — ensure opId exists (clients may generate opId)
  if (type && type.startsWith("stroke")) {
    // Create canonical op and append (we keep every sub-op so that
    // real-time playback and replay both work)
    const opPayload = {
      type: type, // e.g., 'stroke_start', 'stroke_move', 'stroke_end'
      userId: event.userId || null,
      opId: event.opId || generateId(),
      points: event.points || (event.start ? [event.start] : undefined),
      tool: event.tool || "brush",
      color: event.color || "#000000",
      size: event.size || 4,
      bbox: event.bbox || null,
    };

    const op = appendOp(state, opPayload);

    // Broadcast op to room
    io.to(roomId).emit("op", { seq: op.seq, op });
    return;
  }

  // Unknown event types: append as raw op for traceability
  const rawOp = appendOp(state, {
    type: event.type || "unknown",
    userId: event.userId || null,
    raw: event,
  });
  io.to(roomId).emit("op", { seq: rawOp.seq, op: rawOp });
}

/**
 * Get current canvas state when a new user joins
 * @param {string} roomId
 * @returns {object}
 */
function getCanvasState(roomId) {
  const state = getOrCreateRoomState(roomId);
  return {
    type: "room_state",
    snapshot: null, // snapshots can be implemented later
    opLogTail: state.opLog.slice(-1000), // send last 1000 ops for joiners
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
