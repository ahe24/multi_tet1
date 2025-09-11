# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-user Tetris game project designed to run on Rocky Linux servers. The game allows multiple players to play Tetris independently while sharing scores and screen states in real-time for competitive play.

## Architecture

The project follows a client-server architecture:
- **Server**: Rocky Linux-based backend using Node.js (Express + Socket.io) or Python (Flask + Flask-SocketIO)
- **Client**: Web browser-based frontend using HTML5 Canvas and JavaScript
- **Real-time Communication**: WebSocket protocol for live state sharing
- **Data Storage**: Redis for real-time state, SQLite for persistent logs

## Key Components

### Server Components
- **Authentication Module**: Generates unique IDs (UUID) for player names
- **State Management**: Stores player states (scores, grid states as 2D arrays)
- **Broadcast Module**: WebSocket-based real-time updates to all clients
- **Ranking Logic**: Sorts players by score for top player display
- **Dashboard API**: Provides complete player data via GET endpoints

### Client Components
- **Login Module**: Name input form → session creation → game screen
- **Game Engine**: JavaScript-based Tetris logic with Canvas rendering
  - Standard 10x20 grid
  - 7 block types (I, O, T, S, Z, J, L)
  - Keyboard controls (arrows, spacebar)
- **Real-time Viewer**: Left panel showing top players' mini-grids
- **Dashboard**: Popup/separate page displaying all player information

## Data Models

### Player Object
- `id`: string (UUID)
- `name`: string
- `score`: integer
- `grid`: array[20][10] (0: empty, 1-7: block types)
- `status`: enum ('playing', 'gameover')
- `join_time`: timestamp

## Development Setup

The project is designed for Rocky Linux deployment with the following dependencies:
```bash
# Server installation
dnf install nodejs python3 nginx redis sqlite

# Node.js approach
npm install express socket.io

# Python alternative
pip install flask flask-socketio
```

## Implementation Phases

1. Basic Tetris engine (client-side JavaScript)
2. WebSocket integration for state sharing
3. Ranking and screen display logic
4. Dashboard implementation
5. Multi-browser concurrent testing

## Key Considerations

- Network optimization through grid state compression (JSON optimization)
- Redis clustering for scalability
- HTTPS enforcement using Let's Encrypt
- SELinux configuration for port access on Rocky Linux
- Mobile browser support with responsive design
- Real-time updates at 1-5 times per second