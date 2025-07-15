const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class GameServer {
  constructor(port = 3003) {
    this.wss = new WebSocket.Server({ port });
    this.rooms = new Map();
    this.players = new Map();
    
    this.wss.on('connection', (ws) => {
      console.log('New client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('Invalid JSON:', error);
        }
      });
      
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
    
    console.log(`WebSocket server running on port ${port}`);
  }
  
  generateRoomId() {
    let roomId;
    do {
      roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    } while (this.rooms.has(roomId));
    return roomId;
  }
  
  handleMessage(ws, data) {
    console.log('Received message:', data);
    
    switch (data.type) {
      case 'create_room':
        this.createRoom(ws, data);
        break;
      case 'join_room':
        this.joinRoom(ws, data);
        break;
      case 'game_move':
        this.handleGameMove(ws, data);
        break;
      case 'game_reset':
        this.resetGame(ws, data);
        break;
      case 'leave_room':
        this.leaveRoom(ws, data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }
  
  createRoom(ws, data) {
    const roomId = this.generateRoomId();
    const playerId = uuidv4();
    
    const room = {
      id: roomId,
      players: new Map(),
      gameState: {
        board: Array(6).fill(null).map(() => Array(7).fill(null)),
        currentPlayer: 1,
        winner: null,
        gameOver: false,
        moves: []
      },
      createdAt: new Date()
    };
    
    const player = {
      id: playerId,
      username: data.username,
      ws: ws,
      roomId: roomId,
      playerNumber: 1
    };
    
    room.players.set(playerId, player);
    this.rooms.set(roomId, room);
    this.players.set(ws, player);
    
    ws.send(JSON.stringify({
      type: 'room_created',
      roomId: roomId,
      playerId: playerId,
      playerNumber: 1
    }));
    
    console.log(`Room ${roomId} created by ${data.username}`);
  }
  
  joinRoom(ws, data) {
    const room = this.rooms.get(data.roomId);
    
    if (!room) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Room not found'
      }));
      return;
    }
    
    if (room.players.size >= 2) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Room is full'
      }));
      return;
    }
    
    const playerId = uuidv4();
    const player = {
      id: playerId,
      username: data.username,
      ws: ws,
      roomId: data.roomId,
      playerNumber: 2
    };
    
    room.players.set(playerId, player);
    this.players.set(ws, player);
    
    // Send join confirmation to the new player
    ws.send(JSON.stringify({
      type: 'room_joined',
      roomId: data.roomId,
      playerId: playerId,
      playerNumber: 2,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        playerNumber: p.playerNumber
      })),
      gameState: room.gameState
    }));
    
    // Notify other players in the room
    this.broadcastToRoom(data.roomId, {
      type: 'player_joined',
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        playerNumber: p.playerNumber
      })),
      newPlayer: {
        id: playerId,
        username: data.username,
        playerNumber: 2
      }
    }, playerId);
    
    // If room is full, start the game
    if (room.players.size === 2) {
      this.broadcastToRoom(data.roomId, {
        type: 'game_start',
        currentPlayer: 1
      });
    }
    
    console.log(`${data.username} joined room ${data.roomId}`);
  }
  
  handleGameMove(ws, data) {
    const player = this.players.get(ws);
    if (!player) return;
    
    const room = this.rooms.get(player.roomId);
    if (!room) return;
    
    // Validate it's the player's turn
    if (room.gameState.currentPlayer !== player.playerNumber) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not your turn'
      }));
      return;
    }
    
    // Validate the move
    const { column } = data;
    if (column < 0 || column > 6) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid column'
      }));
      return;
    }
    
    // Check if column is full
    if (room.gameState.board[0][column] !== null) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Column is full'
      }));
      return;
    }
    
    // Make the move
    let row = -1;
    for (let r = 5; r >= 0; r--) {
      if (room.gameState.board[r][column] === null) {
        room.gameState.board[r][column] = player.playerNumber;
        row = r;
        break;
      }
    }
    
    // Check for winner
    const winner = this.checkWinner(room.gameState.board, row, column, player.playerNumber);
    if (winner) {
      room.gameState.winner = player.playerNumber;
      room.gameState.gameOver = true;
    } else if (this.isBoardFull(room.gameState.board)) {
      room.gameState.gameOver = true;
    }
    
    // Record the move
    room.gameState.moves.push({
      player: player.playerNumber,
      column: column,
      row: row,
      timestamp: new Date()
    });
    
    // Switch turns
    room.gameState.currentPlayer = room.gameState.currentPlayer === 1 ? 2 : 1;
    
    // Broadcast the move to all players in the room
    this.broadcastToRoom(player.roomId, {
      type: 'game_move',
      move: {
        player: player.playerNumber,
        column: column,
        row: row
      },
      gameState: room.gameState,
      playerName: player.username
    });
    
    console.log(`${player.username} made move in column ${column}`);
  }
  
  resetGame(ws, data) {
    const player = this.players.get(ws);
    if (!player) return;
    
    const room = this.rooms.get(player.roomId);
    if (!room) return;
    
    // Reset game state
    room.gameState = {
      board: Array(6).fill(null).map(() => Array(7).fill(null)),
      currentPlayer: 1,
      winner: null,
      gameOver: false,
      moves: []
    };
    
    // Broadcast reset to all players
    this.broadcastToRoom(player.roomId, {
      type: 'game_reset',
      gameState: room.gameState
    });
    
    console.log(`Game reset in room ${player.roomId}`);
  }
  
  leaveRoom(ws, data) {
    this.handleDisconnect(ws);
  }
  
  handleDisconnect(ws) {
    const player = this.players.get(ws);
    if (!player) return;
    
    const room = this.rooms.get(player.roomId);
    if (room) {
      room.players.delete(player.id);
      
      // Notify other players
      this.broadcastToRoom(player.roomId, {
        type: 'player_left',
        playerId: player.id,
        playerName: player.username,
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          username: p.username,
          playerNumber: p.playerNumber
        }))
      });
      
      // If room is empty, delete it
      if (room.players.size === 0) {
        this.rooms.delete(player.roomId);
        console.log(`Room ${player.roomId} deleted`);
      }
    }
    
    this.players.delete(ws);
    console.log(`Player ${player.username} disconnected`);
  }
  
  broadcastToRoom(roomId, message, excludePlayerId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    room.players.forEach((player) => {
      if (player.id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(message));
      }
    });
  }
  
  checkWinner(board, row, col, player) {
    const directions = [
      [0, 1], [1, 0], [1, 1], [1, -1]
    ];
    
    for (const [dr, dc] of directions) {
      let count = 1;
      
      // Check positive direction
      for (let i = 1; i < 4; i++) {
        const newRow = row + dr * i;
        const newCol = col + dc * i;
        if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 && board[newRow][newCol] === player) {
          count++;
        } else {
          break;
        }
      }
      
      // Check negative direction
      for (let i = 1; i < 4; i++) {
        const newRow = row - dr * i;
        const newCol = col - dc * i;
        if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 && board[newRow][newCol] === player) {
          count++;
        } else {
          break;
        }
      }
      
      if (count >= 4) return true;
    }
    
    return false;
  }
  
  isBoardFull(board) {
    return board[0].every(cell => cell !== null);
  }
  
  // Debug method to get server stats
  getStats() {
    return {
      rooms: this.rooms.size,
      players: this.players.size,
      roomDetails: Array.from(this.rooms.entries()).map(([id, room]) => ({
        id,
        players: room.players.size,
        gameOver: room.gameState.gameOver,
        winner: room.gameState.winner
      }))
    };
  }
}

// Create and start the server
const server = new GameServer(3003);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.wss.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export for testing
module.exports = GameServer;