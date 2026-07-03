const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const NEXT_BLOCK_SIZE = 25;

const TETROMINOS = {
  I: {
    shape: [[1, 1, 1, 1]],
    color: '#00f5ff'
  },
  O: {
    shape: [[1, 1], [1, 1]],
    color: '#ffeb3b'
  },
  T: {
    shape: [[0, 1, 0], [1, 1, 1]],
    color: '#9c27b0'
  },
  S: {
    shape: [[0, 1, 1], [1, 1, 0]],
    color: '#4caf50'
  },
  Z: {
    shape: [[1, 1, 0], [0, 1, 1]],
    color: '#f44336'
  },
  J: {
    shape: [[1, 0, 0], [1, 1, 1]],
    color: '#2196f3'
  },
  L: {
    shape: [[0, 0, 1], [1, 1, 1]],
    color: '#ff9800'
  }
};

const PIECE_NAMES = Object.keys(TETROMINOS);

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('scoreValue');
const levelEl = document.getElementById('levelValue');
const linesEl = document.getElementById('linesValue');
const overlay = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let lines = 0;
let isPlaying = false;
let isPaused = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let animationId = null;

function createBoard() {
  board = [];
  for (let r = 0; r < ROWS; r++) {
    board[r] = [];
    for (let c = 0; c < COLS; c++) {
      board[r][c] = null;
    }
  }
}

function createPiece(type) {
  const tetromino = TETROMINOS[type];
  return {
    type: type,
    shape: tetromino.shape.map(row => [...row]),
    color: tetromino.color,
    x: Math.floor((COLS - tetromino.shape[0].length) / 2),
    y: 0
  };
}

function randomPiece() {
  const name = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
  return createPiece(name);
}

function drawBlock(ctx, x, y, color, size) {
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, lightenColor(color, 30));
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, darkenColor(color, 30));

  ctx.fillStyle = gradient;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

  ctx.strokeStyle = lightenColor(color, 50);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(x + 3, y + 3, size / 3, size / 3);
}

function drawBoard() {
  ctx.fillStyle = 'rgba(10, 10, 26, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(0, 245, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK_SIZE);
    ctx.lineTo(canvas.width, r * BLOCK_SIZE);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK_SIZE, 0);
    ctx.lineTo(c * BLOCK_SIZE, canvas.height);
    ctx.stroke();
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        drawBlock(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, board[r][c], BLOCK_SIZE);
      }
    }
  }
}

function drawPiece() {
  if (!currentPiece) return;

  let ghostY = currentPiece.y;
  while (!checkCollision(currentPiece.shape, currentPiece.x, ghostY + 1)) {
    ghostY++;
  }

  ctx.globalAlpha = 0.2;
  for (let r = 0; r < currentPiece.shape.length; r++) {
    for (let c = 0; c < currentPiece.shape[r].length; c++) {
      if (currentPiece.shape[r][c]) {
        drawBlock(ctx, (currentPiece.x + c) * BLOCK_SIZE, (ghostY + r) * BLOCK_SIZE, currentPiece.color, BLOCK_SIZE);
      }
    }
  }
  ctx.globalAlpha = 1;

  for (let r = 0; r < currentPiece.shape.length; r++) {
    for (let c = 0; c < currentPiece.shape[r].length; c++) {
      if (currentPiece.shape[r][c]) {
        drawBlock(ctx, (currentPiece.x + c) * BLOCK_SIZE, (currentPiece.y + r) * BLOCK_SIZE, currentPiece.color, BLOCK_SIZE);
      }
    }
  }
}

function drawNextPiece() {
  nextCtx.fillStyle = 'rgba(10, 10, 26, 0.5)';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPiece) return;

  const shape = nextPiece.shape;
  const offsetX = (nextCanvas.width - shape[0].length * NEXT_BLOCK_SIZE) / 2;
  const offsetY = (nextCanvas.height - shape.length * NEXT_BLOCK_SIZE) / 2;

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        drawBlock(nextCtx, offsetX + c * NEXT_BLOCK_SIZE, offsetY + r * NEXT_BLOCK_SIZE, nextPiece.color, NEXT_BLOCK_SIZE);
      }
    }
  }
}

function checkCollision(shape, x, y) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        const newX = x + c;
        const newY = y + r;
        if (newX < 0 || newX >= COLS || newY >= ROWS) {
          return true;
        }
        if (newY >= 0 && board[newY][newX]) {
          return true;
        }
      }
    }
  }
  return false;
}

function rotate(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated = [];
  for (let c = 0; c < cols; c++) {
    rotated[c] = [];
    for (let r = rows - 1; r >= 0; r--) {
      rotated[c].push(shape[r][c]);
    }
  }
  return rotated;
}

function rotatePiece() {
  if (!currentPiece || !isPlaying || isPaused) return;

  const rotated = rotate(currentPiece.shape);
  const kickOffsets = [0, -1, 1, -2, 2];

  for (const offset of kickOffsets) {
    if (!checkCollision(rotated, currentPiece.x + offset, currentPiece.y)) {
      currentPiece.shape = rotated;
      currentPiece.x += offset;
      return;
    }
  }
}

function movePiece(dx, dy) {
  if (!currentPiece || !isPlaying || isPaused) return false;

  if (!checkCollision(currentPiece.shape, currentPiece.x + dx, currentPiece.y + dy)) {
    currentPiece.x += dx;
    currentPiece.y += dy;
    return true;
  }
  return false;
}

function hardDrop() {
  if (!currentPiece || !isPlaying || isPaused) return;

  while (movePiece(0, 1)) {
    score += 2;
  }
  updateScore();
  mergePiece();
}

function mergePiece() {
  for (let r = 0; r < currentPiece.shape.length; r++) {
    for (let c = 0; c < currentPiece.shape[r].length; c++) {
      if (currentPiece.shape[r][c]) {
        const boardY = currentPiece.y + r;
        const boardX = currentPiece.x + c;
        if (boardY >= 0) {
          board[boardY][boardX] = currentPiece.color;
        }
      }
    }
  }

  clearLines();
  spawnPiece();
}

function clearLines() {
  let linesCleared = 0;

  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== null)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(null));
      linesCleared++;
      r++;
    }
  }

  if (linesCleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[linesCleared] * level;
    lines += linesCleared;

    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel > level) {
      level = newLevel;
      dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    }

    updateScore();
  }
}

function spawnPiece() {
  currentPiece = nextPiece || randomPiece();
  nextPiece = randomPiece();

  if (checkCollision(currentPiece.shape, currentPiece.x, currentPiece.y)) {
    gameOver();
  }

  drawNextPiece();
}

function updateScore() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;

  scoreEl.classList.remove('bump');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('bump');
}

function gameOver() {
  isPlaying = false;
  cancelAnimationFrame(animationId);

  overlayTitle.textContent = '游戏结束';
  overlayMessage.textContent = `最终得分: ${score}\n等级: ${level}\n消除行数: ${lines}\n点击重新开始再来一局`;
  overlay.classList.remove('hidden');

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = '暂停';
}

function startGame() {
  createBoard();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = 1000;
  isPlaying = true;
  isPaused = false;

  updateScore();

  nextPiece = randomPiece();
  spawnPiece();

  overlay.classList.add('hidden');

  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pauseBtn.textContent = '暂停';

  lastTime = 0;
  dropCounter = 0;
  gameLoop();
}

function togglePause() {
  if (!isPlaying) return;

  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? '继续' : '暂停';

  if (isPaused) {
    overlayTitle.textContent = '游戏暂停';
    overlayMessage.textContent = '按 P 键或点击继续按钮恢复游戏';
    overlay.classList.remove('hidden');
    cancelAnimationFrame(animationId);
  } else {
    overlay.classList.add('hidden');
    lastTime = 0;
    dropCounter = 0;
    gameLoop();
  }
}

function resetGame() {
  cancelAnimationFrame(animationId);
  isPlaying = false;
  isPaused = false;

  createBoard();
  score = 0;
  level = 1;
  lines = 0;
  currentPiece = null;
  nextPiece = null;
  dropInterval = 1000;

  updateScore();
  drawBoard();
  drawNextPiece();

  overlayTitle.textContent = '准备开始';
  overlayMessage.textContent = '按下开始按钮或空格键开始游戏';
  overlay.classList.remove('hidden');

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = '暂停';
}

function gameLoop(time = 0) {
  if (!isPlaying || isPaused) return;

  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > dropInterval) {
    if (!movePiece(0, 1)) {
      mergePiece();
    }
    dropCounter = 0;
  }

  drawBoard();
  drawPiece();

  animationId = requestAnimationFrame(gameLoop);
}

function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
}

function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
}

function init() {
  createBoard();
  drawBoard();
  drawNextPiece();
  updateScore();

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }

    if (e.key === ' ') {
      if (!isPlaying) {
        startGame();
      } else if (!isPaused) {
        hardDrop();
      }
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      togglePause();
      return;
    }

    if (!isPlaying || isPaused) return;

    switch (e.key) {
      case 'ArrowLeft':
        movePiece(-1, 0);
        break;
      case 'ArrowRight':
        movePiece(1, 0);
        break;
      case 'ArrowDown':
        if (movePiece(0, 1)) {
          score += 1;
          updateScore();
        }
        break;
      case 'ArrowUp':
        rotatePiece();
        break;
    }
  });

  startBtn.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', togglePause);
  resetBtn.addEventListener('click', resetGame);

  document.getElementById('leftBtn').addEventListener('click', () => movePiece(-1, 0));
  document.getElementById('rightBtn').addEventListener('click', () => movePiece(1, 0));
  document.getElementById('downBtn').addEventListener('click', () => {
    if (movePiece(0, 1)) {
      score += 1;
      updateScore();
    }
  });
  document.getElementById('rotateBtn').addEventListener('click', rotatePiece);
  document.getElementById('dropBtn').addEventListener('click', hardDrop);
}

init();
