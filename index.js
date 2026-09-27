import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for production if needed
    methods: ["GET", "POST"],
  },
});

// --- CONFIGURATION ---
const APP_PASSWORD = "your_shared_password_here"; // Set your single global password
const JWT_SECRET = "your_super_secret_jwt_key_change_this"; // Secret key for signing tokens

// In-memory data store
const activeUsers = new Map(); // Stores { username: socket.id }
const roomMessages = {
  general: [],
  tech: [],
  random: [],
};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. VERIFY LOGIN & ISSUE JWT TOKEN
  socket.on("verify_login", ({ username, password }, callback) => {
    const trimmedUser = username ? username.trim() : "";

    if (!trimmedUser || !password) {
      return callback({ success: false, error: "Username and password are required" });
    }

    // Check shared app password
    if (password !== APP_PASSWORD) {
      return callback({ success: false, error: "Invalid password" });
    }

    // Check if username is already taken by an active session
    if (activeUsers.has(trimmedUser)) {
      return callback({ success: false, error: "Username is already in use" });
    }

    // Generate JWT token valid for 24 hours
    const token = jwt.sign({ username: trimmedUser }, JWT_SECRET, { expiresIn: "24h" });

    // Track user session
    activeUsers.set(trimmedUser, socket.id);
    socket.username = trimmedUser;

    callback({ success: true, token, username: trimmedUser });
  });

  // 2. JOIN ROOM (REQUIRES VALID JWT TOKEN)
  socket.on("join", ({ roomId, token }) => {
    try {
      if (!token) throw new Error("No token provided");
      
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.username = decoded.username;

      // Re-register active user on reconnect if missing
      if (!activeUsers.has(socket.username)) {
        activeUsers.set(socket.username, socket.id);
      }

      socket.join(roomId);

      // Send existing message history for the room
      const history = roomMessages[roomId] || [];
      socket.emit("load_history", history);

    } catch (err) {
      socket.emit("auth_error", "Session expired or invalid token. Please log in again.");
    }
  });

  // 3. SEND MESSAGE
  socket.on("send", ({ room, message, time }) => {
    if (!socket.username || !message.trim()) return;

    const newMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      room,
      message,
      sender: socket.username,
      time,
      isEdited: false,
    };

    if (!roomMessages[room]) roomMessages[room] = [];
    roomMessages[room].push(newMessage);

    // Keep history manageable (last 100 messages)
    if (roomMessages[room].length > 100) {
      roomMessages[room].shift();
    }

    io.to(room).emit("message", newMessage);
  });

  // 4. TYPING INDICATOR
  socket.on("typing", ({ room }) => {
    if (!socket.username) return;
    socket.to(room).emit("user_typing", { room, user: socket.username });
  });

  // 5. EDIT MESSAGE
  socket.on("edit_message", ({ room, id, newText }) => {
    if (!socket.username || !roomMessages[room]) return;

    const msg = roomMessages[room].find((m) => m.id === id);
    if (msg && msg.sender === socket.username) {
      msg.message = newText;
      msg.isEdited = true;

      // Broadcast re-loaded history to sync edits across clients
      io.to(room).emit("load_history", roomMessages[room]);
    }
  });

  // 6. DELETE MESSAGE
  socket.on("delete_message", ({ room, id }) => {
    if (!socket.username || !roomMessages[room]) return;

    const index = roomMessages[room].findIndex((m) => m.id === id);
    if (index !== -1 && roomMessages[room][index].sender === socket.username) {
      roomMessages[room].splice(index, 1);

      // Broadcast updated history to sync deletions
      io.to(room).emit("load_history", roomMessages[room]);
    }
  });

  // 7. LEAVE ROOM
  socket.on("leave", (roomId) => {
    socket.leave(roomId);
  });

  // 8. DISCONNECT CLEANUP
  socket.on("disconnect", () => {
    if (socket.username) {
      activeUsers.delete(socket.username);
      console.log(`User disconnected: ${socket.username}`);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});