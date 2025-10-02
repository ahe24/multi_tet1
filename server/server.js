const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Database = require('./database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;
const PUBLIC_HOST = process.env.PUBLIC_HOST || HOST;
const PUBLIC_URL = `http://${PUBLIC_HOST}:${PORT}`;

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../client')));

const players = new Map();
const db = new Database();

// Game settings controlled by first player
let gameSettings = {
  gravityEnabled: true,
  firstPlayerId: null
};

class Player {
  constructor(id, name, socket) {
    this.id = id;
    this.name = name;
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.grid = Array(20).fill().map(() => Array(10).fill(0));
    this.status = 'playing';
    this.joinTime = new Date();
    this.gameStartTime = new Date();
    this.socket = socket;
  }

  updateState(data) {
    this.score = data.score || this.score;
    this.level = data.level || this.level;
    this.lines = data.lines || this.lines;
    this.grid = data.grid || this.grid;
    this.status = data.status || this.status;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      level: this.level,
      lines: this.lines,
      grid: this.grid,
      status: this.status,
      joinTime: this.joinTime
    };
  }
}

function getRanking() {
  const playerList = Array.from(players.values())
    .sort((a, b) => b.score - a.score);
  
  return {
    topPlayers: playerList.slice(0, 5),
    allPlayers: playerList
  };
}

function broadcastUpdate() {
  const ranking = getRanking();
  io.emit('gameUpdate', ranking);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send current game settings to new connection
  socket.emit('gameSettings', {
    gravityEnabled: gameSettings.gravityEnabled,
    isFirstPlayer: players.size === 0
  });

  socket.on('joinGame', (data) => {
    const playerId = uuidv4();
    const player = new Player(playerId, data.name, socket);

    players.set(socket.id, player);

    // Set first player if no players exist
    const isFirstPlayer = !gameSettings.firstPlayerId;
    if (isFirstPlayer) {
      gameSettings.firstPlayerId = socket.id;
      console.log(`${data.name} is the first player and can control game settings`);
    }

    // Apply initial gravity setting from data if first player
    if (isFirstPlayer && data.gravityEnabled !== undefined) {
      gameSettings.gravityEnabled = data.gravityEnabled;
      io.emit('gravityUpdate', { gravityEnabled: gameSettings.gravityEnabled });
      console.log(`Gravity set to ${gameSettings.gravityEnabled} by first player`);
    }

    socket.emit('gameJoined', {
      playerId: playerId,
      playerName: data.name,
      isFirstPlayer: isFirstPlayer,
      gravityEnabled: gameSettings.gravityEnabled
    });

    console.log(`Player ${data.name} (${playerId}) joined the game`);
    broadcastUpdate();
  });

  socket.on('gameState', (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.updateState(data);
      broadcastUpdate();
    }
  });

  socket.on('gameOver', async (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.updateState({ ...data, status: 'gameover' });
      console.log(`Player ${player.name} game over with score: ${player.score}`);
      
      // Save game session to database
      try {
        await db.savePlayer({
          id: player.id,
          name: player.name,
          score: player.score,
          level: player.level,
          lines: player.lines
        });

        await db.saveGameSession({
          playerId: player.id,
          playerName: player.name,
          score: player.score,
          level: player.level,
          lines: player.lines,
          startTime: player.gameStartTime.getTime(),
          endTime: Date.now()
        });

        console.log(`Saved game session for ${player.name}: Score ${player.score}`);
      } catch (error) {
        console.error('Error saving game session:', error);
      }
      
      broadcastUpdate();
    }
  });

  socket.on('restartGame', () => {
    const player = players.get(socket.id);
    if (player) {
      player.score = 0;
      player.level = 1;
      player.lines = 0;
      player.grid = Array(20).fill().map(() => Array(10).fill(0));
      player.status = 'playing';
      player.gameStartTime = new Date(); // Reset game start time for new session
      console.log(`Player ${player.name} restarted the game`);
      broadcastUpdate();
    }
  });

  socket.on('sendGarbage', (data) => {
    const player = players.get(socket.id);
    if (player) {
      const garbageAmount = data.amount;
      console.log(`Player ${player.name} sending ${garbageAmount} garbage lines to all opponents`);

      // Send garbage to all other active players
      players.forEach((targetPlayer, targetSocketId) => {
        if (targetSocketId !== socket.id && targetPlayer.status === 'playing') {
          targetPlayer.socket.emit('garbageAttack', {
            amount: garbageAmount,
            fromPlayer: player.name
          });
        }
      });
    }
  });

  socket.on('updateGravity', (data) => {
    // Only allow first player to update gravity
    if (socket.id === gameSettings.firstPlayerId) {
      gameSettings.gravityEnabled = data.gravityEnabled;
      console.log(`First player updated gravity to: ${gameSettings.gravityEnabled}`);

      // Broadcast to all clients
      io.emit('gravityUpdate', { gravityEnabled: gameSettings.gravityEnabled });
    } else {
      console.log(`Non-first player attempted to change gravity setting`);
    }
  });

  socket.on('getDashboard', async () => {
    const ranking = getRanking();
    
    try {
      const topPlayers = await db.getTopPlayers(10);
      const recentSessions = await db.getRecentSessions(20);
      
      socket.emit('dashboardData', {
        ...ranking,
        topPlayersAllTime: topPlayers,
        recentSessions: recentSessions
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      socket.emit('dashboardData', ranking);
    }
  });

  socket.on('disconnect', async () => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`Player ${player.name} disconnected`);

      // Save current game state when player disconnects
      if (player.status === 'playing' && player.score > 0) {
        try {
          await db.savePlayer({
            id: player.id,
            name: player.name,
            score: player.score,
            level: player.level,
            lines: player.lines
          });

          await db.saveGameSession({
            playerId: player.id,
            playerName: player.name,
            score: player.score,
            level: player.level,
            lines: player.lines,
            startTime: player.gameStartTime.getTime(),
            endTime: Date.now()
          });

          console.log(`Saved game progress for disconnected player ${player.name}: Score ${player.score}`);
        } catch (error) {
          console.error('Error saving game progress on disconnect:', error);
        }
      }

      // If first player disconnects, reset first player
      if (socket.id === gameSettings.firstPlayerId) {
        gameSettings.firstPlayerId = null;
        console.log('First player disconnected, resetting first player status');

        // Assign first player to next available player if any
        if (players.size > 1) {
          const nextPlayer = Array.from(players.keys()).find(id => id !== socket.id);
          if (nextPlayer) {
            gameSettings.firstPlayerId = nextPlayer;
            const newFirstPlayer = players.get(nextPlayer);
            console.log(`${newFirstPlayer.name} is now the first player`);
            io.to(nextPlayer).emit('becomeFirstPlayer', { isFirstPlayer: true });
          }
        }
      }

      players.delete(socket.id);
      broadcastUpdate();
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dashboard.html'));
});

server.listen(PORT, HOST, () => {
  console.log(`Multi-Tetris server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Public Host: ${PUBLIC_HOST}`);
  console.log(`Public URL: ${PUBLIC_URL}`);
  console.log(`Access the game at ${PUBLIC_URL}`);
});