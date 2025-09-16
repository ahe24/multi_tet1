class GameManager {
    constructor() {
        this.socket = io();
        this.tetris = null;
        this.playerId = null;
        this.playerName = null;
        
        this.initElements();
        this.setupEventListeners();
        this.setupSocketEvents();
        this.setupKeyboardControls();
        this.setupTouchControls();
        this.setupMouseControls();
        
        this.lastTime = 0;
        this.animationId = null;
    }
    
    initElements() {
        this.loginScreen = document.getElementById('loginScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.gameOverModal = document.getElementById('gameOverModal');
        
        this.loginForm = document.getElementById('loginForm');
        this.playerNameInput = document.getElementById('playerName');
        
        this.currentPlayerEl = document.getElementById('currentPlayer');
        this.scoreEl = document.getElementById('score');
        this.levelEl = document.getElementById('level');
        this.linesEl = document.getElementById('lines');
        this.finalScoreEl = document.getElementById('finalScore');
        this.finalLinesEl = document.getElementById('finalLines');
        
        this.levelProgressFill = document.getElementById('levelProgressFill');
        this.levelCountdown = document.getElementById('levelCountdown');
        
        this.topPlayersEl = document.getElementById('topPlayers');
        
        this.pauseBtn = document.getElementById('pauseBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.dashboardBtn = document.getElementById('dashboardBtn');
        this.playAgainBtn = document.getElementById('playAgainBtn');
        
        this.rotationToggle = document.getElementById('rotationToggle');
        this.rotationDirection = document.getElementById('rotationDirection');
        
        this.gameCanvas = document.getElementById('gameCanvas');
        this.nextCanvas = document.getElementById('nextCanvas');
        
        // Touch control elements
        this.touchControls = document.getElementById('touchControls');
        this.touchMoveLeft = document.getElementById('touchMoveLeft');
        this.touchMoveRight = document.getElementById('touchMoveRight');
        this.touchRotate = document.getElementById('touchRotate');
        this.touchSoftDrop = document.getElementById('touchSoftDrop');
        this.touchHardDrop = document.getElementById('touchHardDrop');
        this.touchPause = document.getElementById('touchPause');
        
        this.previousLevel = 1;
        this.isMobile = this.detectMobile();
    }
    
    setupEventListeners() {
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinGame();
        });
        
        this.pauseBtn.addEventListener('click', () => {
            this.pauseGame();
        });
        
        this.restartBtn.addEventListener('click', () => {
            this.restartGame();
        });
        
        this.dashboardBtn.addEventListener('click', () => {
            window.open('/dashboard', '_blank');
        });
        
        this.playAgainBtn.addEventListener('click', () => {
            this.restartGame();
            this.gameOverModal.classList.add('hidden');
        });
        
        this.rotationToggle.addEventListener('click', () => {
            if (this.tetris) {
                const direction = this.tetris.toggleRotationDirection();
                this.rotationDirection.textContent = direction;
            }
        });
    }
    
    setupSocketEvents() {
        this.socket.on('gameJoined', (data) => {
            this.playerId = data.playerId;
            this.playerName = data.playerName;
            this.currentPlayerEl.textContent = data.playerName;
            
            this.loginScreen.classList.add('hidden');
            this.gameScreen.classList.remove('hidden');
            
            this.startGame();
        });
        
        this.socket.on('gameUpdate', (data) => {
            this.updateTopPlayers(data.topPlayers);
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
        
        this.socket.on('reconnect', () => {
            console.log('Reconnected to server');
        });
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.tetris) return;
            
            switch (e.code) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.tetris.movePiece(-1, 0);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.tetris.movePiece(1, 0);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.tetris.movePiece(0, 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.tetris.rotatePiece();
                    break;
                case 'Space':
                    e.preventDefault();
                    this.tetris.hardDrop();
                    break;
                case 'KeyP':
                    e.preventDefault();
                    this.pauseGame();
                    break;
            }
            
            this.tetris.draw();
        });
    }
    
    joinGame() {
        const name = this.playerNameInput.value.trim();
        if (name) {
            this.socket.emit('joinGame', { name: name });
        }
    }
    
    startGame() {
        this.tetris = new Tetris(this.gameCanvas, this.nextCanvas);
        
        this.tetris.onScoreUpdate = (score, level, lines) => {
            this.scoreEl.textContent = score;
            this.levelEl.textContent = level;
            this.linesEl.textContent = lines;
            
            // Check for level up
            if (level > this.previousLevel) {
                this.triggerLevelUpEffect(level);
                this.previousLevel = level;
            }
            
            // Update level progress
            this.updateLevelProgress(lines, level);
            
            this.sendGameState();
        };
        
        this.tetris.onGameOver = (score, lines) => {
            this.finalScoreEl.textContent = score;
            this.finalLinesEl.textContent = lines;
            this.gameOverModal.classList.remove('hidden');
            this.socket.emit('gameOver', this.tetris.getState());
        };
        
        this.tetris.onStateChange = () => {
            this.sendGameState();
        };
        
        this.tetris.start();
        this.updateRotationDisplay();
        this.startGameLoop();
        this.sendGameState();
    }
    
    startGameLoop() {
        const gameLoop = (currentTime) => {
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            
            if (this.tetris) {
                this.tetris.update(deltaTime);
                this.tetris.draw();
            }
            
            this.animationId = requestAnimationFrame(gameLoop);
        };
        
        this.animationId = requestAnimationFrame(gameLoop);
    }
    
    pauseGame() {
        if (this.tetris) {
            this.tetris.pause();
            this.pauseBtn.textContent = this.tetris.gamePaused ? '재개' : '일시정지';
        }
    }
    
    restartGame() {
        if (this.tetris) {
            this.tetris.restart();
            this.pauseBtn.textContent = '일시정지';
            this.updateRotationDisplay();
            this.previousLevel = 1;
            this.updateLevelProgress(0, 1);
            this.socket.emit('restartGame');
        }
    }
    
    updateRotationDisplay() {
        if (this.tetris && this.rotationDirection) {
            this.rotationDirection.textContent = this.tetris.getRotationDirection();
        }
    }
    
    sendGameState() {
        if (this.tetris) {
            this.socket.emit('gameState', this.tetris.getState());
        }
    }
    
    updateTopPlayers(topPlayers) {
        this.topPlayersEl.innerHTML = '';
        
        // Limit to maximum 4 players and exclude current player
        const otherPlayers = topPlayers.filter(player => player.id !== this.playerId);
        const playersToShow = otherPlayers.slice(0, 4);
        
        playersToShow.forEach((player, index) => {
            const actualRank = topPlayers.findIndex(p => p.id === player.id) + 1;
            const playerDiv = this.createTopPlayerElement(player, actualRank);
            this.topPlayersEl.appendChild(playerDiv);
        });
    }
    
    createTopPlayerElement(player, rank) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'top-player';
        
        const miniCanvas = document.createElement('canvas');
        miniCanvas.width = 80;
        miniCanvas.height = 160;
        miniCanvas.className = 'mini-canvas';
        
        const ctx = miniCanvas.getContext('2d');
        this.drawMiniGrid(ctx, player.grid, miniCanvas.width, miniCanvas.height);
        
        playerDiv.innerHTML = `
            <div class="player-rank">#${rank}</div>
            <div class="player-name">${player.name}</div>
            <div class="player-score">${player.score}</div>
        `;
        
        playerDiv.appendChild(miniCanvas);
        
        return playerDiv;
    }
    
    drawMiniGrid(ctx, grid, width, height) {
        const blockSize = Math.min(width / 10, height / 20);
        const colors = [
            '#000000', '#FF0000', '#00FF00', '#0000FF', 
            '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500'
        ];
        
        ctx.clearRect(0, 0, width, height);
        
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const value = grid[y][x];
                ctx.fillStyle = colors[value] || '#000000';
                ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
                
                if (value !== 0) {
                    ctx.strokeStyle = '#333';
                    ctx.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
                }
            }
        }
    }
    
    updateLevelProgress(lines, level) {
        const currentLevelLines = lines % 10;
        const linesToNextLevel = 10 - currentLevelLines;
        const progressPercent = (currentLevelLines / 10) * 100;
        
        this.levelProgressFill.style.width = `${progressPercent}%`;
        this.levelCountdown.textContent = linesToNextLevel === 10 ? 10 : linesToNextLevel;
        
        // Add pulsing effect when close to level up
        if (linesToNextLevel <= 3) {
            this.levelCountdown.style.animation = 'levelUpGlow 1s ease-in-out infinite alternate';
        } else {
            this.levelCountdown.style.animation = 'none';
        }
    }
    
    triggerLevelUpEffect(newLevel) {
        // Level up effect removed - no visual notification
    }
    
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
               || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }
    
    setupTouchControls() {
        // Show touch controls on mobile devices
        if (this.isMobile && this.touchControls) {
            this.touchControls.classList.remove('hidden');
        }
        
        // Touch button event listeners
        if (this.touchMoveLeft) {
            this.touchMoveLeft.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleGameAction('moveLeft');
            });
        }
        
        if (this.touchMoveRight) {
            this.touchMoveRight.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleGameAction('moveRight');
            });
        }
        
        if (this.touchRotate) {
            this.touchRotate.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleGameAction('rotate');
            });
        }
        
        if (this.touchSoftDrop) {
            this.touchSoftDrop.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleGameAction('softDrop');
            });
        }
        
        if (this.touchHardDrop) {
            this.touchHardDrop.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleGameAction('hardDrop');
            });
        }
        
        if (this.touchPause) {
            this.touchPause.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.pauseGame();
            });
        }
        
        // Canvas touch events for swipe gestures
        if (this.gameCanvas) {
            let touchStartX = 0;
            let touchStartY = 0;
            let touchStartTime = 0;
            
            this.gameCanvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                touchStartTime = Date.now();
            });
            
            this.gameCanvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (!e.changedTouches[0]) return;
                
                const touch = e.changedTouches[0];
                const touchEndX = touch.clientX;
                const touchEndY = touch.clientY;
                const touchEndTime = Date.now();
                
                const deltaX = touchEndX - touchStartX;
                const deltaY = touchEndY - touchStartY;
                const deltaTime = touchEndTime - touchStartTime;
                
                // Quick tap (less than 200ms)
                if (deltaTime < 200 && Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) {
                    this.handleGameAction('rotate');
                    return;
                }
                
                // Swipe detection (minimum 30px movement)
                if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        // Horizontal swipe
                        if (deltaX > 0) {
                            this.handleGameAction('moveRight');
                        } else {
                            this.handleGameAction('moveLeft');
                        }
                    } else {
                        // Vertical swipe
                        if (deltaY > 0) {
                            this.handleGameAction('softDrop');
                        }
                    }
                }
            });
        }
    }
    
    setupMouseControls() {
        if (!this.gameCanvas) return;
        
        // Mouse click controls
        this.gameCanvas.addEventListener('click', (e) => {
            if (!this.tetris) return;
            
            const rect = this.gameCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const canvasWidth = rect.width;
            
            // Click on left side to move left, right side to move right
            if (x < canvasWidth * 0.3) {
                this.handleGameAction('moveLeft');
            } else if (x > canvasWidth * 0.7) {
                this.handleGameAction('moveRight');
            } else {
                // Middle click to rotate
                this.handleGameAction('rotate');
            }
        });
        
        // Mouse wheel rotation
        this.gameCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (!this.tetris) return;
            
            this.handleGameAction('rotate');
        });
        
        // Right-click to rotate
        this.gameCanvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this.tetris) return;
            
            this.handleGameAction('rotate');
        });
        
        // Double-click for hard drop
        this.gameCanvas.addEventListener('dblclick', (e) => {
            e.preventDefault();
            if (!this.tetris) return;
            
            this.handleGameAction('hardDrop');
        });
    }
    
    handleGameAction(action) {
        if (!this.tetris) return;
        
        switch (action) {
            case 'moveLeft':
                this.tetris.movePiece(-1, 0);
                break;
            case 'moveRight':
                this.tetris.movePiece(1, 0);
                break;
            case 'rotate':
                this.tetris.rotatePiece();
                break;
            case 'softDrop':
                this.tetris.movePiece(0, 1);
                break;
            case 'hardDrop':
                this.tetris.hardDrop();
                break;
        }
        
        this.tetris.draw();
    }
    
}

window.addEventListener('load', () => {
    new GameManager();
});