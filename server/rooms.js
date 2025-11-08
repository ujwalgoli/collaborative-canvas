/**
 * server/rooms.js
 * ---------------------------------------------------------
 * Manages room lifecycle and user membership for the
 * Collaborative Canvas project.
 * ---------------------------------------------------------
 * Responsibilities:
 * - Create and retrieve rooms
 * - Track users per room
 * - Handle user disconnections and cleanup
 */

const rooms = {}; // { roomId: { users: { socketId: { userId, displayName } } } }

/**
 * Create a new room if it doesn't exist
 * @param {string} roomId
 * @returns {object} newly created room object
 */
function createRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: {},
    };
    console.log(`🆕 Room created: ${roomId}`);
  }
  return rooms[roomId];
}

/**
 * Get a room by its ID
 * @param {string} roomId
 * @returns {object|null}
 */
function getRoom(roomId) {
  return rooms[roomId] || null;
}

/**
 * Remove user from room when disconnected
 * Cleans up empty rooms automatically
 * @param {string} socketId
 * @returns {string|null} roomId if user removed
 */
function removeUserFromRoom(socketId) {
  for (const [roomId, room] of Object.entries(rooms)) {
    if (room.users[socketId]) {
      delete room.users[socketId];
      console.log(`👋 User ${socketId} left room ${roomId}`);

      // Remove empty room
      if (Object.keys(room.users).length === 0) {
        delete rooms[roomId];
        console.log(`🗑️ Room ${roomId} deleted (empty)`);
      }
      return roomId;
    }
  }
  return null;
}

/**
 * Get list of users in a room
 * @param {string} roomId
 * @returns {Array<{ userId: string, displayName: string }>}
 */
function getUsersInRoom(roomId) {
  const room = getRoom(roomId);
  if (!room) return [];
  return Object.values(room.users);
}

// Exports
module.exports = {
  createRoom,
  getRoom,
  removeUserFromRoom,
  getUsersInRoom,
};
