const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {};

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    rooms[roomCode] = { players: [socket.id], gameState: null };
    socket.join(roomCode);
    socket.emit('room-created', roomCode);
  });

  socket.on('join-room', (roomCode) => {
    if (rooms[roomCode] && rooms[roomCode].players.length < 2) {
      rooms[roomCode].players.push(socket.id);
      socket.join(roomCode);
      io.to(roomCode).emit('start-game', rooms[roomCode].gameState);
    } else {
      socket.emit('error', 'Invalid or full room');
    }
  });

  socket.on('game-move', ({ roomCode, gameState }) => {
    rooms[roomCode].gameState = gameState;
    socket.to(roomCode).emit('game-update', gameState);
  });
});

server.listen(3000, () => console.log('Server running on port 3000'));