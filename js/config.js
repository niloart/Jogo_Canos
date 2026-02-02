/**
 * CONSTANTS & CONFIG
 */
const CONFIG = {
    cols: 8,
    rows: 6,
    tileSize: 80, // Base size, scales dynamically
    bgColor: '#080808',
    pipeInactive: '#4a2c20', // Dim copper
    pipeActive: '#ff5722',   // Glowing orange
    lineWidth: 12,
    animSpeed: 0.2 // Speed of rotation lerp (0.0 to 1.0)
};

// Pipe Directions: North=1, East=2, South=4, West=8
const DIRS = {
    N: 1,
    E: 2,
    S: 4,
    W: 8
};

// Pipe Types Definition
// maps type ID to its connections at rotation 0
const PIPE_TYPES = {
    STRAIGHT: DIRS.N | DIRS.S,    // 5
    ELBOW:    DIRS.N | DIRS.E,    // 3
    TEE:      DIRS.N | DIRS.E | DIRS.S, // 7
    CROSS:    DIRS.N | DIRS.E | DIRS.S | DIRS.W, // 15
    EMPTY:    0
};

/**
 * UTILITIES
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getOppositeDir(dir) {
    if (dir === DIRS.N) return DIRS.S;
    if (dir === DIRS.S) return DIRS.N;
    if (dir === DIRS.E) return DIRS.W;
    if (dir === DIRS.W) return DIRS.E;
    return 0;
}
