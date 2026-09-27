import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createClient } from 'redis';

const app = express();
app.use(cors());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin:"*",
    methods: ["GET", "POST"]
  }
});

const redisClient = createClient({
  username: 'default',
  password: 'q3N1oZXxvOW2WswKwhY1A1DI0ZmMl3eZ',
  socket: {
    host: 'transport-clever-compelling-15702.db.redis.io',
    port: 13514
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log('Connected to Remote Redis successfully!');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
}
connectRedis();

// Helper function to guarantee every message in an array has a unique ID
function ensureMessageIds(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((msg, index) => ({
    ...msg,
    id: msg.id || `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`
  }));
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join", async ({ roomId, username }) => {
    socket.join(roomId);
    console.log(`${username} joined room: ${roomId}`);

    try {
      const key = `chat:${roomId}`;
      const historyJson = await redisClient.get(key);
      let history = historyJson ? JSON.parse(historyJson) : [];
      
      // Auto-assign IDs to older legacy messages
      history = ensureMessageIds(history);
      await redisClient.set(key, JSON.stringify(history));

      socket.emit("load_history", history);
    } catch (err) {
      console.error("Error fetching room history from Redis:", err);
    }
  });

  socket.on("typing", ({ room, user }) => {
    socket.to(room).emit("user_typing", { room, user });
  });

  socket.on("send", async ({ room, message, sender, time }) => {
    try {
      const key = `chat:${room}`;
      const msgData = { 
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, 
        sender, 
        message, 
        time, 
        room 
      };

      const historyJson = await redisClient.get(key);
      let history = historyJson ? JSON.parse(historyJson) : [];
      
      history.push(msgData);
      await redisClient.set(key, JSON.stringify(history));

      // Broadcast to EVERYONE in the room
      io.to(room).emit("message", msgData);
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("edit_message", async ({ room, id, newText }) => {
    try {
      const key = `chat:${room}`;
      const historyJson = await redisClient.get(key);
      
      if (historyJson) {
        let history = JSON.parse(historyJson);
        
        history = history.map((msg) => {
          if (String(msg.id) === String(id)) {
            return { ...msg, message: newText, isEdited: true };
          }
          return msg;
        });

        await redisClient.set(key, JSON.stringify(history));
        io.to(room).emit("load_history", history);
      }
    } catch (err) {
      console.error("Error editing message:", err);
    }
  });

  socket.on("delete_message", async ({ room, id }) => {
    try {
      const key = `chat:${room}`;
      const historyJson = await redisClient.get(key);
      
      if (historyJson) {
        let history = JSON.parse(historyJson);
        
        history = history.filter((msg) => String(msg.id) !== String(id));

        await redisClient.set(key, JSON.stringify(history));
        io.to(room).emit("load_history", history);
      }
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  });

  socket.on("leave", (roomId) => {
    socket.leave(roomId);
    console.log(`User left room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});