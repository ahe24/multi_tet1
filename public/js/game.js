class GameManager {
    constructor() {
        this.socket = io();
        this.tetris = null;
        this.playerId = null;
        this.playerName = null;
        this.isFirstPlayer = false;
        this.gravityEnabled = false;

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
        this.spectatorScreen = document.getElementById('spectatorScreen');

        this.loginForm = document.getElementById('loginForm');
        this.playerNameInput = document.getElementById('playerName');
        this.viewDashboardBtn = document.getElementById('viewDashboardBtn');

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
        this.spectatorBtn = document.getElementById('spectatorBtn');

        // Spectator mode elements
        this.spectatorPlayersEl = document.getElementById('spectatorPlayers');
        this.spectatorFinalScore = document.getElementById('spectatorFinalScore');
        this.spectatorFinalLines = document.getElementById('spectatorFinalLines');
        this.joinGameBtn = document.getElementById('joinGameBtn');
        this.spectatorDashboardBtn = document.getElementById('spectatorDashboardBtn');

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

        // Gravity control elements
        this.gravityControlContainer = document.getElementById('gravityControlContainer');
        this.gravityToggle = document.getElementById('gravityToggle');
        this.gravityGameControl = document.getElementById('gravityGameControl');
        this.gravityGameToggle = document.getElementById('gravityGameToggle');

        this.previousLevel = 1;
        this.isMobile = this.detectMobile();
        this.isSpectating = false;
    }
    
    setupEventListeners() {
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinGame();
        });

        this.viewDashboardBtn.addEventListener('click', () => {
            window.open('/dashboard', '_blank');
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

        this.spectatorBtn.addEventListener('click', () => {
            this.enterSpectatorMode();
        });

        this.joinGameBtn.addEventListener('click', () => {
            this.exitSpectatorMode();
        });

        this.spectatorDashboardBtn.addEventListener('click', () => {
            window.open('/dashboard', '_blank');
        });

        this.rotationToggle.addEventListener('click', () => {
            if (this.tetris) {
                const direction = this.tetris.toggleRotationDirection();
                this.rotationDirection.textContent = direction;
            }
        });

        // Gravity toggle event (during gameplay, first player only)
        if (this.gravityGameToggle) {
            this.gravityGameToggle.addEventListener('change', (e) => {
                if (this.isFirstPlayer) {
                    const gravityEnabled = e.target.checked;
                    this.socket.emit('updateGravity', { gravityEnabled });
                } else {
                    // Revert change if not first player
                    e.target.checked = this.gravityEnabled;
                }
            });
        }
    }
    
    setupSocketEvents() {
        this.socket.on('gameSettings', (data) => {
            // Received on connection - show gravity toggle if first player
            this.gravityEnabled = data.gravityEnabled;
            if (data.isFirstPlayer && this.gravityControlContainer) {
                this.gravityControlContainer.classList.remove('hidden');
            }
        });

        this.socket.on('gameJoined', (data) => {
            this.playerId = data.playerId;
            this.playerName = data.playerName;
            this.isFirstPlayer = data.isFirstPlayer;
            this.gravityEnabled = data.gravityEnabled;
            this.currentPlayerEl.textContent = data.playerName;

            // Show in-game gravity control if first player
            if (this.isFirstPlayer && this.gravityGameControl) {
                this.gravityGameControl.classList.remove('hidden');
            }

            this.loginScreen.classList.add('hidden');
            this.gameScreen.classList.remove('hidden');

            this.startGame();
        });

        this.socket.on('becomeFirstPlayer', (data) => {
            // When original first player disconnects
            this.isFirstPlayer = true;
            if (this.gravityGameControl) {
                this.gravityGameControl.classList.remove('hidden');
            }
            console.log('You are now the first player and can control settings');
        });

        this.socket.on('gravityUpdate', (data) => {
            // Received when gravity setting changes
            this.gravityEnabled = data.gravityEnabled;
            if (this.gravityGameToggle) {
                this.gravityGameToggle.checked = data.gravityEnabled;
            }
            if (this.tetris) {
                this.tetris.setGravityEnabled(data.gravityEnabled);
            }
            console.log(`Gravity ${data.gravityEnabled ? 'enabled' : 'disabled'}`);
        });

        this.socket.on('gameUpdate', (data) => {
            if (this.isSpectating) {
                this.updateSpectatorPlayers(data.topPlayers);
            } else {
                this.updateTopPlayers(data.topPlayers);
            }
        });

        this.socket.on('garbageAttack', (data) => {
            // Receive garbage attack from another player
            if (this.tetris) {
                this.tetris.addIncomingGarbage(data.amount);
                this.showGarbageNotification(data.amount, data.fromPlayer);
            }
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
            const gravityEnabled = this.gravityToggle ? this.gravityToggle.checked : false;
            this.socket.emit('joinGame', {
                name: name,
                gravityEnabled: gravityEnabled
            });
        }
    }
    
    startGame() {
        this.tetris = new Tetris(this.gameCanvas, this.nextCanvas);
        this.tetris.setGravityEnabled(this.gravityEnabled);

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

        this.tetris.onGarbageAttack = (amount) => {
            // Send garbage attack to all other players
            this.socket.emit('sendGarbage', { amount: amount });
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
                this.drawGarbageIndicator();
            }

            this.animationId = requestAnimationFrame(gameLoop);
        };

        this.animationId = requestAnimationFrame(gameLoop);
    }

    drawGarbageIndicator() {
        if (!this.tetris || this.tetris.incomingGarbage <= 0) return;

        const canvas = this.gameCanvas;
        const ctx = canvas.getContext('2d');

        // Draw red bar on the right side of the canvas
        const barWidth = 8;
        const maxHeight = canvas.height;
        const barHeight = Math.min((this.tetris.incomingGarbage / 10) * maxHeight, maxHeight);

        // Semi-transparent red bar
        ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
        ctx.fillRect(canvas.width - barWidth, maxHeight - barHeight, barWidth, barHeight);

        // Number indicator at top of bar
        if (this.tetris.incomingGarbage > 0) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                this.tetris.incomingGarbage.toString(),
                canvas.width - barWidth / 2,
                maxHeight - barHeight - 5
            );
        }
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
        // Track previous player statuses for animation triggers
        if (!this.playerStatuses) {
            this.playerStatuses = {};
        }

        this.topPlayersEl.innerHTML = '';

        // Limit to maximum 6 players and exclude current player
        const otherPlayers = topPlayers.filter(player => player.id !== this.playerId);
        const playersToShow = otherPlayers.slice(0, 6);

        playersToShow.forEach((player, index) => {
            const actualRank = topPlayers.findIndex(p => p.id === player.id) + 1;
            const playerDiv = this.createTopPlayerElement(player, actualRank);
            this.topPlayersEl.appendChild(playerDiv);

            // Check if this player just got game over (status changed)
            const wasPlaying = this.playerStatuses[player.id] === 'playing';
            const isGameOver = player.status === 'gameover';

            if (wasPlaying && isGameOver) {
                // Trigger flash and shake animation
                playerDiv.classList.add('flash-red', 'shake');

                // Remove animation classes after animation completes
                setTimeout(() => {
                    playerDiv.classList.remove('flash-red', 'shake');
                }, 500);
            }

            // Update stored status
            this.playerStatuses[player.id] = player.status;
        });
    }
    
    createTopPlayerElement(player, rank) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'top-player';
        playerDiv.dataset.playerId = player.id;

        const miniCanvas = document.createElement('canvas');
        miniCanvas.width = 80;
        miniCanvas.height = 160;
        miniCanvas.className = 'mini-canvas';

        const ctx = miniCanvas.getContext('2d');
        this.drawMiniGrid(ctx, player.grid, miniCanvas.width, miniCanvas.height);

        playerDiv.innerHTML = `
            <div class="player-name">${player.name}</div>
        `;

        playerDiv.appendChild(miniCanvas);

        // Apply game over effect if player status is 'gameover'
        if (player.status === 'gameover') {
            playerDiv.classList.add('game-over');
        }

        return playerDiv;
    }
    
    drawMiniGrid(ctx, grid, width, height) {
        const blockSize = Math.min(width / 10, height / 20);
        const colors = [
            '#000000', // Empty
            '#FF0000', // I piece
            '#00FF00', // O piece
            '#0000FF', // T piece
            '#FFFF00', // S piece
            '#FF00FF', // Z piece
            '#00FFFF', // J piece
            '#FFA500', // L piece
            '#808080'  // Garbage block
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

    showGarbageNotification(amount, fromPlayer) {
        // Create subtle notification
        const notification = document.createElement('div');
        notification.className = 'garbage-notification';
        notification.textContent = `+${amount}`;
        notification.style.cssText = `
            position: absolute;
            top: 50%;
            right: 10px;
            transform: translateY(-50%);
            background: rgba(128, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 18px;
            font-weight: bold;
            z-index: 1000;
            animation: slideInOut 2s ease-in-out;
        `;

        this.gameScreen.style.position = 'relative';
        this.gameScreen.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 2000);
    }

    enterSpectatorMode() {
        console.log('Entering spectator mode...');
        this.isSpectating = true;

        // Store final score and lines
        const finalScore = this.tetris ? this.tetris.score : 0;
        const finalLines = this.tetris ? this.tetris.lines : 0;

        console.log('Final score:', finalScore, 'Final lines:', finalLines);

        if (this.spectatorFinalScore && this.spectatorFinalLines) {
            this.spectatorFinalScore.textContent = finalScore;
            this.spectatorFinalLines.textContent = finalLines;
        } else {
            console.error('Spectator score/lines elements not found');
        }

        // Hide game screen and modal, show spectator screen
        this.gameScreen.classList.add('hidden');
        this.gameOverModal.classList.add('hidden');
        this.spectatorScreen.classList.remove('hidden');

        console.log('Spectator screen visible:', !this.spectatorScreen.classList.contains('hidden'));

        // Stop game loop if running
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        console.log('Entered spectator mode - isSpectating:', this.isSpectating);

        // Immediately request current game state
        this.socket.emit('requestGameUpdate');
    }

    exitSpectatorMode() {
        this.isSpectating = false;

        // Hide spectator screen, show game screen
        this.spectatorScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');

        // Restart the game
        this.restartGame();

        console.log('Exited spectator mode');
    }

    updateSpectatorPlayers(topPlayers) {
        // Track previous player statuses for animation triggers
        if (!this.spectatorStatuses) {
            this.spectatorStatuses = {};
        }

        if (!this.spectatorPlayersEl) {
            console.error('Spectator players element not found');
            return;
        }

        this.spectatorPlayersEl.innerHTML = '';

        // Show all players except yourself (including those with gameover status)
        const otherPlayers = topPlayers.filter(player => player.id !== this.playerId);

        console.log('Spectator mode - All players:', topPlayers.length);
        console.log('Spectator mode - Other players:', otherPlayers.length);

        if (otherPlayers.length === 0) {
            this.spectatorPlayersEl.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: rgba(255,255,255,0.7); padding: 2rem;">
                    <p style="font-size: 1.2rem;">현재 활성 플레이어가 없습니다</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">다른 플레이어가 게임에 참여할 때까지 기다려주세요</p>
                </div>
            `;
            return;
        }

        otherPlayers.forEach((player, index) => {
            const rank = topPlayers.findIndex(p => p.id === player.id) + 1;
            const playerDiv = this.createSpectatorPlayerElement(player, rank);
            this.spectatorPlayersEl.appendChild(playerDiv);

            // Check if this player just got game over (status changed)
            const wasPlaying = this.spectatorStatuses[player.id] === 'playing';
            const isGameOver = player.status === 'gameover';

            if (wasPlaying && isGameOver) {
                // Trigger flash and shake animation
                playerDiv.classList.add('flash-red', 'shake');

                // Remove animation classes after animation completes
                setTimeout(() => {
                    playerDiv.classList.remove('flash-red', 'shake');
                }, 500);
            }

            // Update stored status
            this.spectatorStatuses[player.id] = player.status;
        });
    }

    createSpectatorPlayerElement(player, rank) {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'spectator-player';
        playerDiv.dataset.playerId = player.id;

        const spectatorCanvas = document.createElement('canvas');
        spectatorCanvas.width = 160;
        spectatorCanvas.height = 320;
        spectatorCanvas.className = 'spectator-canvas';

        const ctx = spectatorCanvas.getContext('2d');
        this.drawMiniGrid(ctx, player.grid, spectatorCanvas.width, spectatorCanvas.height);

        playerDiv.innerHTML = `
            <div class="spectator-player-rank">#${rank}</div>
            <div class="spectator-player-name">${player.name}</div>
            <div class="spectator-player-score">점수: ${player.score} | 레벨: ${player.level || 1}</div>
        `;

        playerDiv.appendChild(spectatorCanvas);

        // Apply game over effect if player status is 'gameover'
        if (player.status === 'gameover') {
            playerDiv.classList.add('game-over');
        }

        return playerDiv;
    }

}

window.addEventListener('load', () => {
    new GameManager();
});