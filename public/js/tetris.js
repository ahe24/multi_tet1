class Tetris {
    constructor(canvas, nextCanvas) {
        this.canvas = canvas;
        this.nextCanvas = nextCanvas;
        this.ctx = canvas.getContext('2d');
        this.nextCtx = nextCanvas.getContext('2d');
        
        this.ROWS = 20;
        this.COLS = 10;
        this.BLOCK_SIZE = 30;
        
        this.grid = Array(this.ROWS).fill().map(() => Array(this.COLS).fill(0));
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropTime = 0;
        this.dropInterval = 1000;
        
        this.currentPiece = null;
        this.nextPiece = null;

        this.gameRunning = false;
        this.gamePaused = false;
        this.rotationDirection = -1; // -1 for counterclockwise (default), 1 for clockwise

        // Line clearing animation system
        this.linesToClear = [];
        this.clearingLines = false;
        this.clearAnimationTime = 0;
        this.clearAnimationDuration = 500; // 500ms animation
        this.flashEffect = null;

        // Gravity animation system
        this.gravityEnabled = false; // Can be toggled by first player
        this.gravityBlocks = []; // Blocks currently falling due to gravity
        this.applyingGravity = false;
        this.gravityAnimationTime = 0;
        this.gravityAnimationDuration = 300; // 300ms gravity animation
        
        this.colors = [
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
        
        // Garbage line system
        this.incomingGarbage = 0; // Queue of garbage lines to add
        this.garbageColor = 8; // Special color for garbage blocks

        this.pieces = {
            I: [
                [0,0,0,0],
                [1,1,1,1],
                [0,0,0,0],
                [0,0,0,0]
            ],
            O: [
                [2,2],
                [2,2]
            ],
            T: [
                [0,3,0],
                [3,3,3],
                [0,0,0]
            ],
            S: [
                [0,4,4],
                [4,4,0],
                [0,0,0]
            ],
            Z: [
                [5,5,0],
                [0,5,5],
                [0,0,0]
            ],
            J: [
                [6,0,0],
                [6,6,6],
                [0,0,0]
            ],
            L: [
                [0,0,7],
                [7,7,7],
                [0,0,0]
            ]
        };
        
        this.pieceTypes = Object.keys(this.pieces);
        this.lastTime = 0;
        
        this.onScoreUpdate = null;
        this.onGameOver = null;
        this.onStateChange = null;
        this.onGarbageAttack = null; // Callback when player sends garbage to others
    }
    
    init() {
        this.nextPiece = this.createRandomPiece();
        this.spawnPiece();
        this.draw();
        this.drawNext();
    }
    
    createRandomPiece() {
        const type = this.pieceTypes[Math.floor(Math.random() * this.pieceTypes.length)];
        return {
            shape: this.pieces[type],
            x: Math.floor(this.COLS / 2) - Math.floor(this.pieces[type][0].length / 2),
            y: 0,
            type: type
        };
    }
    
    spawnPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createRandomPiece();
        
        if (this.isCollision(this.currentPiece, 0, 0)) {
            this.gameOver();
            return false;
        }
        
        this.drawNext();
        return true;
    }
    
    isCollision(piece, dx, dy, rotation = null) {
        const shape = rotation !== null ? this.rotate(piece.shape, rotation) : piece.shape;
        const newX = piece.x + dx;
        const newY = piece.y + dy;
        
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x] !== 0) {
                    const gridX = newX + x;
                    const gridY = newY + y;
                    
                    if (gridX < 0 || gridX >= this.COLS || 
                        gridY >= this.ROWS ||
                        (gridY >= 0 && this.grid[gridY][gridX] !== 0)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    rotate(matrix, direction = 1) {
        const N = matrix.length;
        const rotated = Array(N).fill().map(() => Array(N).fill(0));
        
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
                if (direction === 1) {
                    rotated[j][N - 1 - i] = matrix[i][j];
                } else {
                    rotated[N - 1 - j][i] = matrix[i][j];
                }
            }
        }
        return rotated;
    }
    
    movePiece(dx, dy) {
        if (!this.currentPiece || !this.gameRunning || this.gamePaused) return false;

        if (!this.isCollision(this.currentPiece, dx, dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            return true;
        }

        if (dy > 0) {
            this.placePiece();

            // Insert garbage lines before clearing lines
            this.insertGarbageLines();

            this.clearLines();

            // Only spawn new piece if no lines are being cleared
            if (!this.clearingLines) {
                if (!this.spawnPiece()) {
                    return false;
                }
            }
        }

        return false;
    }
    
    rotatePiece() {
        if (!this.currentPiece || !this.gameRunning || this.gamePaused) return;
        
        const rotatedShape = this.rotate(this.currentPiece.shape, this.rotationDirection);
        if (!this.isCollision({...this.currentPiece, shape: rotatedShape}, 0, 0)) {
            this.currentPiece.shape = rotatedShape;
        }
    }
    
    toggleRotationDirection() {
        this.rotationDirection *= -1;
        return this.rotationDirection === 1 ? '시계방향' : '반시계방향';
    }
    
    getRotationDirection() {
        return this.rotationDirection === 1 ? '시계방향' : '반시계방향';
    }

    setGravityEnabled(enabled) {
        this.gravityEnabled = enabled;
        console.log(`Tetris gravity ${enabled ? 'enabled' : 'disabled'}`);
    }

    placePiece() {
        const piece = this.currentPiece;
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x] !== 0) {
                    const gridY = piece.y + y;
                    const gridX = piece.x + x;
                    if (gridY >= 0) {
                        this.grid[gridY][gridX] = piece.shape[y][x];
                    }
                }
            }
        }
        
        // Debug: Log bottom row after placing piece
        console.log('Bottom row after placing piece:', this.grid[this.ROWS - 1]);
    }
    
    clearLines() {
        this.linesToClear = [];
        
        // Find all complete lines
        for (let y = this.ROWS - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell !== 0)) {
                this.linesToClear.push(y);
                console.log(`Found complete line at row ${y}:`, this.grid[y]);
            }
        }
        
        console.log('Lines to clear:', this.linesToClear);
        
        if (this.linesToClear.length > 0) {
            // Start line clearing animation
            this.clearingLines = true;
            this.clearAnimationTime = 0;
            
            // Trigger special effects based on number of lines
            this.triggerLineClearEffect(this.linesToClear.length);
            
            // Don't update score/level immediately - wait for animation to complete
        }
    }
    
    triggerLineClearEffect(linesCount) {
        const canvas = this.canvas;
        
        // Flash effect based on number of lines
        const flashColors = [
            null,
            '#ffff00', // 1 line - yellow
            '#ff8000', // 2 lines - orange  
            '#ff0080', // 3 lines - magenta
            '#00ff80'  // 4 lines (Tetris) - bright green
        ];
        
        if (linesCount >= 1 && linesCount <= 4) {
            this.flashEffect = {
                color: flashColors[linesCount],
                intensity: linesCount === 4 ? 1.0 : 0.6,
                duration: linesCount === 4 ? 800 : 400,
                time: 0
            };
            
            // Add screen shake for multiple lines
            if (linesCount >= 3) {
                this.addScreenShake(linesCount === 4 ? 10 : 6);
            }
        }
    }
    
    addScreenShake(intensity) {
        const canvas = this.canvas;
        const originalTransform = canvas.style.transform;
        
        let shakeCount = 0;
        const maxShakes = intensity;
        
        const shake = () => {
            if (shakeCount < maxShakes) {
                const x = (Math.random() - 0.5) * intensity;
                const y = (Math.random() - 0.5) * intensity;
                canvas.style.transform = `translate(${x}px, ${y}px)`;
                shakeCount++;
                setTimeout(shake, 50);
            } else {
                canvas.style.transform = originalTransform;
            }
        };
        
        shake();
    }
    
    updateLineClearAnimation(deltaTime) {
        if (!this.clearingLines) return;
        
        this.clearAnimationTime += deltaTime;
        
        // Flash effect
        if (this.flashEffect && this.flashEffect.time < this.flashEffect.duration) {
            this.flashEffect.time += deltaTime;
        }
        
        // Complete animation
        if (this.clearAnimationTime >= this.clearAnimationDuration) {
            this.completeLinesClearing();
        }
    }
    
    completeLinesClearing() {
        const linesCleared = this.linesToClear.length;

        // Actually remove the lines from grid
        this.linesToClear.sort((a, b) => b - a); // Sort descending to remove from bottom up

        // Create a new grid without the cleared lines
        const newGrid = [];
        for (let y = 0; y < this.ROWS; y++) {
            if (!this.linesToClear.includes(y)) {
                newGrid.push([...this.grid[y]]);
            }
        }

        // Add empty lines at the top
        while (newGrid.length < this.ROWS) {
            newGrid.unshift(Array(this.COLS).fill(0));
        }

        this.grid = newGrid;

        // Apply gravity physics to make floating blocks fall
        this.startGravityAnimation();

        // Update score and level
        this.lines += linesCleared;
        const points = [0, 40, 100, 300, 1200][linesCleared] * this.level;
        this.score += points;

        this.level = Math.floor(this.lines / 10) + 1;
        this.dropInterval = Math.max(50, 1000 - (this.level - 1) * 50);

        // Garbage system: Cancel incoming garbage first, then send attack
        const garbageToSend = this.calculateGarbageLines(linesCleared);
        if (garbageToSend > 0) {
            if (this.incomingGarbage > 0) {
                // Cancel incoming garbage
                const cancelled = Math.min(this.incomingGarbage, garbageToSend);
                this.incomingGarbage -= cancelled;
                const remaining = garbageToSend - cancelled;

                // Send remaining as attack
                if (remaining > 0 && this.onGarbageAttack) {
                    this.onGarbageAttack(remaining);
                }
            } else {
                // Send all as attack
                if (this.onGarbageAttack) {
                    this.onGarbageAttack(garbageToSend);
                }
            }
        }

        // Reset animation state
        this.clearingLines = false;
        this.linesToClear = [];
        this.clearAnimationTime = 0;
        this.flashEffect = null;

        // Spawn new piece after line clearing is complete (only if no gravity animation)
        if (!this.applyingGravity) {
            if (!this.spawnPiece()) {
                this.gameOver();
                return;
            }
        }

        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score, this.level, this.lines);
        }

        if (this.onStateChange) {
            this.onStateChange();
        }
    }
    
    startGravityAnimation() {
        // Skip gravity animation if disabled
        if (!this.gravityEnabled) {
            console.log('Gravity disabled - skipping animation');
            return;
        }

        this.gravityBlocks = [];

        // Make a copy of current grid state (after lines were cleared)
        const afterClearGrid = this.grid.map(row => [...row]);

        console.log('=== Starting Gravity Animation ===');

        // Calculate gravity - find blocks that need to fall
        for (let x = 0; x < this.COLS; x++) {
            for (let y = this.ROWS - 2; y >= 0; y--) {
                if (afterClearGrid[y][x] !== 0) {
                    // Calculate how far this block can fall
                    let fallDistance = 0;
                    for (let checkY = y + 1; checkY < this.ROWS; checkY++) {
                        if (afterClearGrid[checkY][x] === 0) {
                            fallDistance++;
                        } else {
                            break;
                        }
                    }

                    if (fallDistance > 0) {
                        console.log(`Block at (${x}, ${y}) falls ${fallDistance} rows to (${x}, ${y + fallDistance})`);

                        // Add to gravity animation
                        this.gravityBlocks.push({
                            x: x,
                            startY: y,
                            endY: y + fallDistance,
                            value: afterClearGrid[y][x],
                            animationProgress: 0
                        });

                        // Update grid with final positions
                        afterClearGrid[y][x] = 0;
                        afterClearGrid[y + fallDistance][x] = this.gravityBlocks[this.gravityBlocks.length - 1].value;
                    }
                }
            }
        }

        if (this.gravityBlocks.length > 0) {
            this.applyingGravity = true;
            this.gravityAnimationTime = 0;

            console.log(`Total blocks falling: ${this.gravityBlocks.length}`);

            // Update grid to final state immediately (lines stay cleared)
            this.grid = afterClearGrid;
        } else {
            console.log('No gravity needed - no floating blocks');
        }
    }
    
    updateGravityAnimation(deltaTime) {
        if (!this.applyingGravity) return;
        
        this.gravityAnimationTime += deltaTime;
        const progress = Math.min(this.gravityAnimationTime / this.gravityAnimationDuration, 1);
        
        // Update animation progress for all falling blocks
        this.gravityBlocks.forEach(block => {
            block.animationProgress = this.easeOutBounce(progress);
        });
        
        // Complete animation
        if (progress >= 1) {
            this.completeGravityAnimation();
        }
    }
    
    easeOutBounce(t) {
        if (t < 1/2.75) {
            return 7.5625 * t * t;
        } else if (t < 2/2.75) {
            return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
        } else if (t < 2.5/2.75) {
            return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
        } else {
            return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
        }
    }
    
    completeGravityAnimation() {
        // Grid is already in final state, just reset animation flags
        this.applyingGravity = false;
        this.gravityBlocks = [];
        this.gravityAnimationTime = 0;

        // Check if gravity created new complete lines and clear them
        // The piece spawning is handled in completeLinesClearing() after all recursive clears
        this.clearLines();
    }
    
    hardDrop() {
        if (!this.currentPiece || !this.gameRunning || this.gamePaused) return;

        while (!this.isCollision(this.currentPiece, 0, 1)) {
            this.currentPiece.y++;
        }
        this.placePiece();

        // Insert garbage lines before clearing lines
        this.insertGarbageLines();

        this.clearLines();

        // Only spawn new piece if no lines are being cleared
        if (!this.clearingLines) {
            this.spawnPiece();
        }
    }
    
    update(deltaTime) {
        if (!this.gameRunning || this.gamePaused) return;
        
        // Update line clearing animation
        this.updateLineClearAnimation(deltaTime);
        
        // Update gravity animation
        this.updateGravityAnimation(deltaTime);
        
        // Don't drop pieces while clearing lines or applying gravity
        if (this.clearingLines || this.applyingGravity) return;
        
        this.dropTime += deltaTime;
        
        if (this.dropTime >= this.dropInterval) {
            this.movePiece(0, 1);
            this.dropTime = 0;
        }
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        this.drawGravityBlocks();
        this.drawPiece();
        this.drawGhostPiece();
        this.drawLineClearEffects();
        this.drawFlashEffect();
    }
    
    drawGrid() {
        // Create a set of positions that are currently animating (falling)
        const animatingPositions = new Set();
        if (this.applyingGravity && this.gravityBlocks.length > 0) {
            // Create a map of end positions to check overlaps
            const endPositions = new Set();
            this.gravityBlocks.forEach(block => {
                endPositions.add(`${block.x},${block.endY}`);
            });

            this.gravityBlocks.forEach(block => {
                // Hide the final position where the block will land
                animatingPositions.add(`${block.x},${block.endY}`);

                // Also hide the start position ONLY if no other block is landing there
                if (!endPositions.has(`${block.x},${block.startY}`)) {
                    animatingPositions.add(`${block.x},${block.startY}`);
                }
            });

            // Debug: log what we're hiding
            if (this.gravityBlocks.length > 0 && this.gravityAnimationTime < 100) {
                console.log('Hiding grid positions:', Array.from(animatingPositions).join(' | '));
            }
        }

        for (let y = 0; y < this.ROWS; y++) {
            for (let x = 0; x < this.COLS; x++) {
                // Skip drawing blocks that are currently animating
                if (animatingPositions.has(`${x},${y}`)) {
                    // Draw empty block instead
                    this.ctx.fillStyle = this.colors[0];
                    this.ctx.fillRect(x * this.BLOCK_SIZE, y * this.BLOCK_SIZE,
                                    this.BLOCK_SIZE, this.BLOCK_SIZE);
                    this.ctx.strokeStyle = '#333';
                    this.ctx.strokeRect(x * this.BLOCK_SIZE, y * this.BLOCK_SIZE,
                                      this.BLOCK_SIZE, this.BLOCK_SIZE);
                } else {
                    const value = this.grid[y][x];
                    this.ctx.fillStyle = this.colors[value];
                    this.ctx.fillRect(x * this.BLOCK_SIZE, y * this.BLOCK_SIZE,
                                    this.BLOCK_SIZE, this.BLOCK_SIZE);

                    this.ctx.strokeStyle = '#333';
                    this.ctx.strokeRect(x * this.BLOCK_SIZE, y * this.BLOCK_SIZE,
                                      this.BLOCK_SIZE, this.BLOCK_SIZE);
                }
            }
        }
    }
    
    drawPiece() {
        if (!this.currentPiece) return;
        
        const piece = this.currentPiece;
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x] !== 0) {
                    const drawX = (piece.x + x) * this.BLOCK_SIZE;
                    const drawY = (piece.y + y) * this.BLOCK_SIZE;
                    
                    this.ctx.fillStyle = this.colors[piece.shape[y][x]];
                    this.ctx.fillRect(drawX, drawY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                    
                    this.ctx.strokeStyle = '#333';
                    this.ctx.strokeRect(drawX, drawY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                }
            }
        }
    }
    
    drawGhostPiece() {
        if (!this.currentPiece) return;
        
        let ghostY = this.currentPiece.y;
        while (!this.isCollision(this.currentPiece, 0, ghostY - this.currentPiece.y + 1)) {
            ghostY++;
        }
        
        const piece = this.currentPiece;
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x] !== 0) {
                    const drawX = (piece.x + x) * this.BLOCK_SIZE;
                    const drawY = (ghostY + y) * this.BLOCK_SIZE;
                    
                    this.ctx.fillStyle = this.colors[piece.shape[y][x]] + '40';
                    this.ctx.fillRect(drawX, drawY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                    
                    this.ctx.strokeStyle = '#666';
                    this.ctx.strokeRect(drawX, drawY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                }
            }
        }
    }
    
    drawNext() {
        if (!this.nextPiece) return;
        
        this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        const piece = this.nextPiece;
        const blockSize = 20;
        const offsetX = (this.nextCanvas.width - piece.shape[0].length * blockSize) / 2;
        const offsetY = (this.nextCanvas.height - piece.shape.length * blockSize) / 2;
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x] !== 0) {
                    const drawX = offsetX + x * blockSize;
                    const drawY = offsetY + y * blockSize;
                    
                    this.nextCtx.fillStyle = this.colors[piece.shape[y][x]];
                    this.nextCtx.fillRect(drawX, drawY, blockSize, blockSize);
                    
                    this.nextCtx.strokeStyle = '#333';
                    this.nextCtx.strokeRect(drawX, drawY, blockSize, blockSize);
                }
            }
        }
    }
    
    start() {
        this.gameRunning = true;
        this.gamePaused = false;
        this.init();
    }
    
    pause() {
        this.gamePaused = !this.gamePaused;
    }
    
    restart() {
        this.grid = Array(this.ROWS).fill().map(() => Array(this.COLS).fill(0));
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropTime = 0;
        this.dropInterval = 1000;
        this.gameRunning = true;
        this.gamePaused = false;
        this.rotationDirection = -1; // Reset to counterclockwise (default) on restart
        
        // Reset animation state
        this.clearingLines = false;
        this.linesToClear = [];
        this.clearAnimationTime = 0;
        this.flashEffect = null;
        
        // Reset gravity animation state
        this.applyingGravity = false;
        this.gravityBlocks = [];
        this.gravityAnimationTime = 0;
        
        this.init();
        
        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score, this.level, this.lines);
        }
        
        if (this.onStateChange) {
            this.onStateChange();
        }
    }
    
    gameOver() {
        this.gameRunning = false;
        if (this.onGameOver) {
            this.onGameOver(this.score, this.lines);
        }
    }
    
    drawLineClearEffects() {
        if (!this.clearingLines || this.linesToClear.length === 0) return;
        
        const progress = this.clearAnimationTime / this.clearAnimationDuration;
        
        // Draw flashing/pulsing effect on lines being cleared
        this.linesToClear.forEach(y => {
            for (let x = 0; x < this.COLS; x++) {
                const alpha = 0.5 + 0.5 * Math.sin(progress * Math.PI * 8); // Pulsing effect
                const drawX = x * this.BLOCK_SIZE;
                const drawY = y * this.BLOCK_SIZE;
                
                // White flash overlay
                this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
                this.ctx.fillRect(drawX, drawY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                
                // Colored border effect based on line count
                const borderColors = ['', '#ffff00', '#ff8000', '#ff0080', '#00ff80'];
                if (this.linesToClear.length <= 4) {
                    this.ctx.strokeStyle = borderColors[this.linesToClear.length] + 'ff';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(drawX, drawY, this.BLOCK_SIZE, this.BLOCK_SIZE);
                }
            }
        });
    }
    
    drawFlashEffect() {
        if (!this.flashEffect || this.flashEffect.time > this.flashEffect.duration) return;
        
        const progress = this.flashEffect.time / this.flashEffect.duration;
        const alpha = this.flashEffect.intensity * (1 - progress) * 0.3;
        
        // Full screen flash
        this.ctx.fillStyle = this.flashEffect.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawGravityBlocks() {
        if (!this.applyingGravity || this.gravityBlocks.length === 0) return;

        // Debug: log animation state once
        if (this.gravityAnimationTime < 50) {
            console.log('Animation progress:', this.gravityBlocks.map(b =>
                `(${b.x},${b.startY}→${b.endY}): ${(b.animationProgress * 100).toFixed(0)}%`
            ).join(' | '));
        }

        // Draw falling blocks with animation
        this.gravityBlocks.forEach(block => {
            const animatedY = block.startY + (block.endY - block.startY) * block.animationProgress;
            const drawX = block.x * this.BLOCK_SIZE;
            const drawY = Math.round(animatedY * this.BLOCK_SIZE); // Round to avoid sub-pixel rendering

            // Draw the falling block with standard styling
            this.ctx.fillStyle = this.colors[block.value];
            this.ctx.fillRect(drawX, drawY, this.BLOCK_SIZE, this.BLOCK_SIZE);

            // Standard border
            this.ctx.strokeStyle = '#333';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(drawX, drawY, this.BLOCK_SIZE, this.BLOCK_SIZE);
        });
    }
    
    getState() {
        return {
            grid: this.grid,
            score: this.score,
            level: this.level,
            lines: this.lines,
            status: this.gameRunning ? 'playing' : 'gameover',
            incomingGarbage: this.incomingGarbage
        };
    }

    // Calculate garbage lines to send based on lines cleared
    calculateGarbageLines(linesCleared) {
        const garbageMap = {
            1: 0, // Single - no garbage
            2: 1, // Double - 1 garbage line
            3: 2, // Triple - 2 garbage lines
            4: 4  // Tetris - 4 garbage lines
        };
        return garbageMap[linesCleared] || 0;
    }

    // Add incoming garbage to queue
    addIncomingGarbage(amount) {
        this.incomingGarbage += amount;
        console.log(`Incoming garbage: +${amount}, Total queued: ${this.incomingGarbage}`);
    }

    // Insert garbage lines at bottom when piece locks
    insertGarbageLines() {
        if (this.incomingGarbage <= 0 || !this.gameRunning) return;

        const garbageToAdd = this.incomingGarbage;
        this.incomingGarbage = 0;

        console.log(`Inserting ${garbageToAdd} garbage lines`);

        // Shift existing grid up
        for (let i = 0; i < garbageToAdd; i++) {
            // Remove top line
            this.grid.shift();

            // Add garbage line at bottom with one random gap
            const garbageLine = Array(this.COLS).fill(this.garbageColor);
            const gapPosition = Math.floor(Math.random() * this.COLS);
            garbageLine[gapPosition] = 0; // Create gap

            this.grid.push(garbageLine);
        }

        console.log(`Inserted ${garbageToAdd} garbage lines successfully`);

        // Broadcast state change after garbage insertion
        if (this.onStateChange) {
            this.onStateChange();
        }

        // Check if any blocks exist in the top rows (game over condition)
        // Check top 2 rows for any placed blocks
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < this.COLS; x++) {
                if (this.grid[y][x] !== 0) {
                    console.log(`Game over: block detected at row ${y}, col ${x} after garbage insertion`);
                    this.gameOver();
                    return;
                }
            }
        }
    }

}