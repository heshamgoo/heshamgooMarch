import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const httpServer = createServer(app);

async function startServer() {
  const PORT = 3000;
  
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // WebSocket handling
  const documentRooms = new Map(); // roomId -> { users: Map(socketId -> user), data: any }

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-document', ({ documentId, user }) => {
      socket.join(documentId);
      
      if (!documentRooms.has(documentId)) {
        documentRooms.set(documentId, { users: new Map(), data: null });
      }
      
      const room = documentRooms.get(documentId);
      room.users.set(socket.id, { ...user, socketId: socket.id, cursor: null });
      
      // Broadcast updated presence to everyone in the room
      io.to(documentId).emit('presence-update', Array.from(room.users.values()));
      
      // Send current document state to the new user if it exists
      if (room.data) {
        socket.emit('document-sync', room.data);
      }
    });

    socket.on('document-update', ({ documentId, data }) => {
      const room = documentRooms.get(documentId);
      if (room) {
        room.data = data;
        // Broadcast to everyone else in the room
        socket.to(documentId).emit('document-update', data);
      }
    });

    socket.on('cursor-move', ({ documentId, cursor }) => {
      const room = documentRooms.get(documentId);
      if (room && room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        user.cursor = cursor;
        socket.to(documentId).emit('presence-update', Array.from(room.users.values()));
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      documentRooms.forEach((room, documentId) => {
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          io.to(documentId).emit('presence-update', Array.from(room.users.values()));
          if (room.users.size === 0) {
            // Optional: cleanup empty rooms after a delay
            // documentRooms.delete(documentId);
          }
        }
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

export default app;
