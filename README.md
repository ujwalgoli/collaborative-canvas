# 🎨 Real-Time Collaborative Drawing Canvas

A multi-user **real-time collaborative drawing application** built with **Vanilla JavaScript**, **HTML5 Canvas**, and **Node.js (Socket.IO)**.

This project allows multiple users to draw simultaneously on the same canvas with smooth synchronization, global undo/redo, and live user indicators — all without any frontend frameworks or drawing libraries.

---

## 🚀 Features Implemented

### 🖌️ Drawing Tools

- Brush and Eraser tools
- Adjustable stroke width and color selector
- Smooth continuous stroke rendering

### 🔁 Real-Time Synchronization

- All users see drawings **as they are being drawn**, not after
- Canvas state is consistent across all connected clients
- Latency-tolerant updates through Socket.IO

### 👥 User Management

- Displays list of online users with unique color indicators
- Auto-removes disconnected users
- Assigns deterministic color per user for stroke and cursor tracking

### 🧭 User Indicators

- Live cursor position for each user
- Colored cursor markers that fade after inactivity

### ↩️ Global Undo / Redo

- Works **across all users** (undo your own or latest stroke)
- Server-managed operation log ensures consistency for everyone

### ⚡ Conflict Resolution

- Overlapping strokes are handled using operation order (last-write wins)
- Replay logic ensures deterministic rendering on every client

---

## 🛠️ Tech Stack

| Layer                | Technology                                   |
| -------------------- | -------------------------------------------- |
| **Frontend**         | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| **Backend**          | Node.js, Express.js, Socket.IO               |
| **Transport**        | WebSockets                                   |
| **State Management** | In-memory operation log (`drawing-state.js`) |

---

## 📂 Folder Structure

collaborative-canvas/
│
├── client/
│ ├── index.html # Frontend layout
│ ├── style.css # UI styling
│ ├── canvas.js # Drawing logic and rendering
│ ├── websocket.js # Real-time WebSocket communication
│ └── main.js # App integration (UI + logic)
│
├── server/
│ ├── server.js # Express + WebSocket backend
│ ├── rooms.js # Room & user management
│ └── drawing-state.js # Global operation log + undo/redo
│
├── README.md
├── ARCHITECTURE.md
└── package.json
