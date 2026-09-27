import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const activeUsers = new Map();
const roomMessages = {
  general: [],
  tech: [],
  random: [],
};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Simple Login (No JWT, just saves username)
  socket.on("verify_login", ({ username }, callback) => {
    if (!username || !username.trim()) {
      return callback({ success: false, error: "Username is required" });
    }

    const cleanUsername = username.trim();
    socket.username = cleanUsername;
    activeUsers.set(socket.id, cleanUsername);

    // Send back success without needing a token
    callback({ success: true, token: "no-token-needed", username: cleanUsername });
  });

  // 2. Simple Join Room
  socket.on("join", ({ roomId, username }) => {
    socket.join(roomId);
    if (username) socket.username = username;
    
    console.log(`${socket.username || "User"} joined room: ${roomId}`);

    const history = roomMessages[roomId] || [];
    socket.emit("load_history", history);
  });

  // 3. Handle Messages
  socket.on("send", ({ room, message, time }) => {
    if (!message || !message.trim()) return;

    const newMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      room,
      message: message.trim(),
      sender: socket.username || "Anonymous",
      time,
      isEdited: false,
    };

    if (!roomMessages[room]) roomMessages[room] = [];
    roomMessages[room].push(newMessage);

    io.to(room).emit("message", newMessage);
  });

  socket.on("disconnect", () => {
    activeUsers.delete(socket.id);
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});