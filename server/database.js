const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        const dbPath = path.join(__dirname, '../data/tetris.db');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database');
                this.createTables();
            }
        });
    }

    createTables() {
        const createPlayersTable = `
            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                high_score INTEGER DEFAULT 0,
                total_games INTEGER DEFAULT 0,
                total_lines INTEGER DEFAULT 0,
                highest_level INTEGER DEFAULT 1,
                first_played DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_played DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const createGameSessionsTable = `
            CREATE TABLE IF NOT EXISTS game_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id TEXT NOT NULL,
                player_name TEXT NOT NULL,
                score INTEGER NOT NULL,
                level INTEGER NOT NULL,
                lines INTEGER NOT NULL,
                duration INTEGER,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players (id)
            )
        `;

        this.db.run(createPlayersTable, (err) => {
            if (err) {
                console.error('Error creating players table:', err.message);
            } else {
                console.log('Players table ready');
            }
        });

        this.db.run(createGameSessionsTable, (err) => {
            if (err) {
                console.error('Error creating game_sessions table:', err.message);
            } else {
                console.log('Game sessions table ready');
            }
        });
    }

    async savePlayer(playerData) {
        return new Promise((resolve, reject) => {
            const { id, name, score, level, lines } = playerData;
            
            // First, get or create player record
            this.db.get(
                'SELECT * FROM players WHERE id = ?',
                [id],
                (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (row) {
                        // Update existing player
                        const newHighScore = Math.max(row.high_score, score);
                        const newHighestLevel = Math.max(row.highest_level, level);
                        
                        this.db.run(
                            `UPDATE players SET 
                             high_score = ?, 
                             total_games = total_games + 1,
                             total_lines = total_lines + ?,
                             highest_level = ?,
                             last_played = CURRENT_TIMESTAMP
                             WHERE id = ?`,
                            [newHighScore, lines, newHighestLevel, id],
                            (err) => {
                                if (err) reject(err);
                                else resolve({ updated: true, newHighScore });
                            }
                        );
                    } else {
                        // Create new player
                        this.db.run(
                            `INSERT INTO players (id, name, high_score, total_games, total_lines, highest_level)
                             VALUES (?, ?, ?, 1, ?, ?)`,
                            [id, name, score, lines, level],
                            (err) => {
                                if (err) reject(err);
                                else resolve({ created: true, newHighScore: score });
                            }
                        );
                    }
                }
            );
        });
    }

    async saveGameSession(sessionData) {
        return new Promise((resolve, reject) => {
            const { playerId, playerName, score, level, lines, startTime, endTime } = sessionData;
            const duration = endTime && startTime ? Math.floor((endTime - startTime) / 1000) : null;
            
            this.db.run(
                `INSERT INTO game_sessions (player_id, player_name, score, level, lines, duration, started_at, ended_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [playerId, playerName, score, level, lines, duration, 
                 new Date(startTime).toISOString(), new Date(endTime || Date.now()).toISOString()],
                function(err) {
                    if (err) reject(err);
                    else resolve({ sessionId: this.lastID });
                }
            );
        });
    }

    async getTopPlayers(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT id, name, high_score, total_games, total_lines, highest_level, 
                        last_played, first_played
                 FROM players 
                 ORDER BY high_score DESC 
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getRecentSessions(limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM game_sessions 
                 ORDER BY ended_at DESC 
                 LIMIT ?`,
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getPlayerStats(playerId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM players WHERE id = ?',
                [playerId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = Database;