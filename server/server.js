const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

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

  socket.on('joinGame', (data) => {
    const playerId = uuidv4();
    const player = new Player(playerId, data.name, socket);
    
    players.set(socket.id, player);
    
    socket.emit('gameJoined', {
      playerId: playerId,
      playerName: data.name
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

  socket.on('gameOver', (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.updateState({ ...data, status: 'gameover' });
      console.log(`Player ${player.name} game over with score: ${player.score}`);
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
      console.log(`Player ${player.name} restarted the game`);
      broadcastUpdate();
    }
  });

  socket.on('getDashboard', () => {
    const ranking = getRanking();
    socket.emit('dashboardData', ranking);
  });

  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      console.log(`Player ${player.name} disconnected`);
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