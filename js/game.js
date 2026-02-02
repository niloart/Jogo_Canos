/**
 * CLASS: GAME
 * Handles Logic, Input, and Rendering
 */
class NeuralCircuit {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('overlay');
        this.restartBtn = document.getElementById('restartBtn');
        
        this.grid = [];
        this.startPoint = null; // {r, c, side}
        this.endPoint = null;
        this.path = []; // List of coords in the solution path
        this.isGameOver = false;

        this.tileSize = CONFIG.tileSize;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Inputs
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.restartBtn.addEventListener('click', () => this.initLevel());

        this.initLevel();
        this.loop();
    }

    resize() {
        // Calculate max tiles that fit screen with margin
        // Use Math.max to prevent negative dimensions on very small screens/iframes
        const maxWidth = Math.max(100, window.innerWidth - 40);
        const maxHeight = Math.max(100, window.innerHeight - 100);
        
        // Determine pixel size per tile based on Aspect Ratio
        const sizeW = Math.floor(maxWidth / CONFIG.cols);
        const sizeH = Math.floor(maxHeight / CONFIG.rows);
        
        // Cap at 100px, but ensure minimum of 10px to prevent negative radius errors in canvas
        this.tileSize = Math.max(10, Math.min(sizeW, sizeH, 100)); 
        
        this.canvas.width = this.tileSize * CONFIG.cols;
        this.canvas.height = this.tileSize * CONFIG.rows;
    }

    /**
     * LEVEL GENERATION ALGORITHM
     */
    initLevel() {
        this.isGameOver = false;
        this.overlay.classList.remove('visible');
        this.grid = [];

        // 1. Initialize Empty Grid
        for(let r=0; r<CONFIG.rows; r++) {
            let row = [];
            for(let c=0; c<CONFIG.cols; c++) {
                row.push(new Tile(c, r, PIPE_TYPES.EMPTY));
            }
            this.grid.push(row);
        }

        // 2. Pick Start and End Points on Perimeter
        // Side: 0=Top, 1=Right, 2=Bottom, 3=Left
        const startSide = randomInt(0, 3);
        // Force end side to be somewhat opposite/distant
        let endSide = (startSide + 2) % 4; 
        
        this.startPoint = this.generatePerimeterPoint(startSide);
        this.endPoint = this.generatePerimeterPoint(endSide);

        // 3. Generate a VALID path using Random Walk / Backtracking
        const solutionPath = this.generatePath(this.startPoint, this.endPoint);

        // 4. Convert Path to Pipe Types
        this.applyPathToGrid(solutionPath);

        // 5. Fill Empty spots with Decoys
        this.fillDecoys();

        // 6. Scramble Rotations
        this.scramble();

        // 7. Initial Flow Check
        this.checkFlow();
    }

    generatePerimeterPoint(side) {
        // Returns coordinate inside grid adjacent to the edge
        let r, c, entryDir;
        if (side === 0) { // Top
            r = 0; c = randomInt(0, CONFIG.cols-1); entryDir = DIRS.N;
        } else if (side === 1) { // Right
            r = randomInt(0, CONFIG.rows-1); c = CONFIG.cols-1; entryDir = DIRS.E;
        } else if (side === 2) { // Bottom
            r = CONFIG.rows-1; c = randomInt(0, CONFIG.cols-1); entryDir = DIRS.S;
        } else { // Left
            r = randomInt(0, CONFIG.rows-1); c = 0; entryDir = DIRS.W;
        }
        return {r, c, entryDir, side};
    }

    generatePath(start, end) {
        // Simple randomized DFS
        let stack = [{r: start.r, c: start.c, parent: null}];
        let visited = new Set();
        
        while(stack.length > 0) {
            let current = stack.pop(); // Use pop for DFS (long snakey paths)
            let key = `${current.r},${current.c}`;

            if (current.r === end.r && current.c === end.c) {
                // Reconstruct path
                let path = [];
                let currNode = current;
                while(currNode) {
                    path.unshift({r: currNode.r, c: currNode.c});
                    currNode = currNode.parent;
                }
                return path;
            }

            visited.add(key);

            // Get Neighbors
            let neighbors = [
                {r: current.r-1, c: current.c},
                {r: current.r+1, c: current.c},
                {r: current.r, c: current.c-1},
                {r: current.r, c: current.c+1}
            ];

            // Shuffle neighbors to make it random
            neighbors.sort(() => Math.random() - 0.5);

            for (let n of neighbors) {
                // Bounds check
                if (n.r >= 0 && n.r < CONFIG.rows && n.c >= 0 && n.c < CONFIG.cols) {
                    if (!visited.has(`${n.r},${n.c}`)) {
                        // Check if we already added it to stack (prevent loops)
                        // Simple check: just push, visited set handles loops on pop, 
                        // but for strict path generation we need to be careful not to box ourselves in.
                        // For a simple puzzle, standard randomized DFS works well enough.
                        stack.push({r: n.r, c: n.c, parent: current});
                    }
                }
            }
        }
        
        // Fallback if fails (should be rare on small grid): Restart
        console.log("Regenerating...");
        return this.initLevel();
    }

    applyPathToGrid(path) {
        if (!path) return;

        for (let i = 0; i < path.length; i++) {
            let curr = path[i];
            let prev = (i === 0) ? null : path[i-1];
            let next = (i === path.length-1) ? null : path[i+1];

            // Determine Entrance Direction
            let dirIn = 0;
            if (!prev) {
                // Connected to Start Point (Outside)
                dirIn = this.startPoint.entryDir; 
            } else {
                if (prev.r < curr.r) dirIn = DIRS.N; // Came from North
                if (prev.r > curr.r) dirIn = DIRS.S; // Came from South
                if (prev.c < curr.c) dirIn = DIRS.W; // Came from West
                if (prev.c > curr.c) dirIn = DIRS.E; // Came from East
            }

            // Determine Exit Direction
            let dirOut = 0;
            if (!next) {
                // Connected to End Point (Outside)
                // End Point structure has 'entryDir' which is the wall side.
                // If endpoint is on RIGHT wall, we exit EAST.
                dirOut = this.endPoint.entryDir;
            } else {
                if (next.r < curr.r) dirOut = DIRS.N;
                if (next.r > curr.r) dirOut = DIRS.S;
                if (next.c < curr.c) dirOut = DIRS.W;
                if (next.c > curr.c) dirOut = DIRS.E;
            }

            // Combine dirs to find shape
            const mask = dirIn | dirOut;
            
            // Map mask to Pipe Type
            // Note: Since we only have specific shapes, we assign the base shape
            // that matches this configuration at Rotation 0, OR any rotation.
            // But to keep logic simple: we assign the Type, and set Rotation to 0.
            // The scramble phase will handle hiding the solution.
            
            if (mask === (DIRS.N | DIRS.S)) this.grid[curr.r][curr.c].type = PIPE_TYPES.STRAIGHT;
            else if (mask === (DIRS.E | DIRS.W)) {
                 this.grid[curr.r][curr.c].type = PIPE_TYPES.STRAIGHT;
                 this.grid[curr.r][curr.c].rotation = 1; // Pre-rotate to match H
            }
            else if (mask === (DIRS.N | DIRS.E)) this.grid[curr.r][curr.c].type = PIPE_TYPES.ELBOW;
            else if (mask === (DIRS.E | DIRS.S)) { this.grid[curr.r][curr.c].type = PIPE_TYPES.ELBOW; this.grid[curr.r][curr.c].rotation = 1; }
            else if (mask === (DIRS.S | DIRS.W)) { this.grid[curr.r][curr.c].type = PIPE_TYPES.ELBOW; this.grid[curr.r][curr.c].rotation = 2; }
            else if (mask === (DIRS.W | DIRS.N)) { this.grid[curr.r][curr.c].type = PIPE_TYPES.ELBOW; this.grid[curr.r][curr.c].rotation = 3; }
            else {
                // Fallback for weird overlaps (shouldn't happen in simple path)
                this.grid[curr.r][curr.c].type = PIPE_TYPES.CROSS; 
            }
        }
    }

    fillDecoys() {
        const types = [PIPE_TYPES.STRAIGHT, PIPE_TYPES.ELBOW, PIPE_TYPES.TEE, PIPE_TYPES.CROSS];
        for(let r=0; r<CONFIG.rows; r++) {
            for(let c=0; c<CONFIG.cols; c++) {
                if (this.grid[r][c].type === PIPE_TYPES.EMPTY) {
                    this.grid[r][c].type = types[randomInt(0, 3)];
                }
            }
        }
    }

    scramble() {
        for(let r=0; r<CONFIG.rows; r++) {
            for(let c=0; c<CONFIG.cols; c++) {
                // Random rotation 0 to 3
                let randRot = randomInt(0, 3);
                this.grid[r][c].rotation = randRot;
                this.grid[r][c].targetRotation = randRot;
                this.grid[r][c].visualRotation = randRot * (Math.PI/2);
            }
        }
    }

    /**
     * GAME LOGIC
     */
    handleClick(e) {
        if (this.isGameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const c = Math.floor(x / this.tileSize);
        const r = Math.floor(y / this.tileSize);

        if (c >= 0 && c < CONFIG.cols && r >= 0 && r < CONFIG.rows) {
            this.grid[r][c].rotate();
            this.checkFlow();
        }
    }

    checkFlow() {
        // Reset all lit states
        for(let r=0; r<CONFIG.rows; r++) {
            for(let c=0; c<CONFIG.cols; c++) {
                this.grid[r][c].isLit = false;
            }
        }

        // Flood fill from Start
        // Start Point defines where the power comes IN to the grid.
        const startR = this.startPoint.r;
        const startC = this.startPoint.c;
        const entryDir = this.startPoint.entryDir;

        // The start tile must connect towards the entry direction
        // e.g., if entry is North (coming from Top), the Tile must have North connection.
        const startTile = this.grid[startR][startC];
        
        // Check if start tile connects to the input
        if (startTile.getConnections() & entryDir) {
            this.propagateFlow(startR, startC, entryDir);
        }
    }

    propagateFlow(r, c, fromDir) {
        const tile = this.grid[r][c];
        if (tile.isLit) return; // Already visited/lit in this pass

        tile.isLit = true;

        // Check Win Condition:
        // Are we at the End Point?
        if (r === this.endPoint.r && c === this.endPoint.c) {
            // Does this tile connect to the exit?
            if (tile.getConnections() & this.endPoint.entryDir) {
                this.triggerWin();
            }
        }

        // Check neighbors
        const cons = tile.getConnections();

        // If connects North and we didn't just come from North
        if ((cons & DIRS.N) && fromDir !== DIRS.N) {
            this.tryConnect(r-1, c, DIRS.S); // Neighbor must connect South
        }
        if ((cons & DIRS.E) && fromDir !== DIRS.E) {
            this.tryConnect(r, c+1, DIRS.W); // Neighbor must connect West
        }
        if ((cons & DIRS.S) && fromDir !== DIRS.S) {
            this.tryConnect(r+1, c, DIRS.N); // Neighbor must connect North
        }
        if ((cons & DIRS.W) && fromDir !== DIRS.W) {
            this.tryConnect(r, c-1, DIRS.E); // Neighbor must connect East
        }
    }

    tryConnect(r, c, requiredConnection) {
        if (r < 0 || r >= CONFIG.rows || c < 0 || c >= CONFIG.cols) return;
        
        const neighbor = this.grid[r][c];
        const neighborCons = neighbor.getConnections();

        if (neighborCons & requiredConnection) {
            // Match found! Continue flow from the direction we entered
            // If we needed South connection, it means we entered from North (DIRS.N)
            // Wait, helper logic: propagateFlow takes 'fromDir' as the side of the TILE we entered.
            // If I am at (0,0) and move East to (0,1).
            // (0,0) has East connection. (0,1) has West connection.
            // I enter (0,1) from the West side (DIRS.W).
            
            let enteredFrom = 0;
            if (requiredConnection === DIRS.S) enteredFrom = DIRS.N; // Entered from top
            if (requiredConnection === DIRS.N) enteredFrom = DIRS.S; // Entered from bottom
            if (requiredConnection === DIRS.W) enteredFrom = DIRS.E; // Entered from right
            if (requiredConnection === DIRS.E) enteredFrom = DIRS.W; // Entered from left

            this.propagateFlow(r, c, requiredConnection); 
        }
    }

    triggerWin() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        setTimeout(() => {
            this.overlay.classList.add('visible');
        }, 500);
    }

    /**
     * RENDER LOOP
     */
    loop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update & Draw Grid
        for(let r=0; r<CONFIG.rows; r++) {
            for(let c=0; c<CONFIG.cols; c++) {
                this.grid[r][c].update();
                this.grid[r][c].draw(this.ctx, this.tileSize);
            }
        }

        // Draw Input/Output Indicators
        this.drawIO(this.startPoint, true);
        this.drawIO(this.endPoint, false);

        requestAnimationFrame(() => this.loop());
    }

    drawIO(point, isStart) {
        if (!point) return;

        const size = this.tileSize;
        const cx = point.c * size + size/2;
        const cy = point.r * size + size/2;

        let offsetX = 0, offsetY = 0;
        const offsetAmt = size * 0.6; // Draw just outside grid

        if (point.entryDir === DIRS.N) offsetY = -offsetAmt; // Top edge
        if (point.entryDir === DIRS.S) offsetY = offsetAmt;  // Bottom edge
        if (point.entryDir === DIRS.W) offsetX = -offsetAmt; // Left edge
        if (point.entryDir === DIRS.E) offsetX = offsetAmt;  // Right edge

        this.ctx.save();
        this.ctx.translate(cx + offsetX, cy + offsetY);

        // Glow
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = isStart ? '#fff' : CONFIG.pipeActive;
        this.ctx.fillStyle = isStart ? '#fff' : CONFIG.pipeActive;
        
        // Draw Connector Line
        this.ctx.beginPath();
        this.ctx.moveTo(0,0);
        // Draw line towards grid center
        this.ctx.lineTo(-offsetX*0.6, -offsetY*0.6); 
        this.ctx.strokeStyle = this.ctx.fillStyle;
        this.ctx.lineWidth = size * 0.2;
        this.ctx.stroke();

        // Draw Circle Node
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size * 0.25, 0, Math.PI*2);
        this.ctx.fill();

        // Text Label
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowBlur = 0;
        this.ctx.fillText(isStart ? "IN" : "OUT", 0, 0);

        this.ctx.restore();
    }
}
