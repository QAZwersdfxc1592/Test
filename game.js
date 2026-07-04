// ====================================================================
// 俄罗斯方块游戏逻辑
// 功能:7-bag 随机、SRS 双向旋转、Hold、Ghost、T-spin/B2B 评分、
//       Web Audio 音效、最高分持久化、多语言(i18n)、移动端触控
// ====================================================================
(function() {
'use strict';

// ============ 配置常量 ============
const COLS = 10;            // 棋盘列数
const ROWS = 20;            // 棋盘行数
const BLOCK_SIZE = 30;      // 主棋盘每格像素
const NEXT_BLOCK_SIZE = 25; // 预览区每格像素

// 7 种方块定义:形状矩阵 + 颜色
const TETROMINOS = {
  I: { shape: [[1, 1, 1, 1]],              color: '#00f5ff' },
  O: { shape: [[1, 1], [1, 1]],            color: '#ffeb3b' },
  T: { shape: [[0, 1, 0], [1, 1, 1]],      color: '#9c27b0' },
  S: { shape: [[0, 1, 1], [1, 1, 0]],      color: '#4caf50' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]],      color: '#f44336' },
  J: { shape: [[1, 0, 0], [1, 1, 1]],      color: '#2196f3' },
  L: { shape: [[0, 0, 1], [1, 1, 1]],      color: '#ff9800' }
};
const PIECE_NAMES = Object.keys(TETROMINOS);

// ============ DOM 引用 ============
const canvas       = document.getElementById('gameCanvas');
const ctx          = canvas.getContext('2d');
const nextCanvas   = document.getElementById('nextCanvas');
const nextCtx      = nextCanvas.getContext('2d');
const holdCanvas   = document.getElementById('holdCanvas');
const holdCtx      = holdCanvas.getContext('2d');

const scoreEl      = document.getElementById('scoreValue');
const levelEl      = document.getElementById('levelValue');
const linesEl      = document.getElementById('linesValue');
const highScoreEl  = document.getElementById('highScoreValue');
const overlay      = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMsg   = document.getElementById('overlayMessage');
const clearTextEl  = document.getElementById('clearText');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const muteBtn  = document.getElementById('muteBtn');

// ============ 游戏状态 ============
let board = [];                // 棋盘二维数组,每格存颜色字符串或 null
let currentPiece = null;       // 当前下落方块
let nextPiece = null;          // 下一个方块
let holdPiece = null;          // 暂存方块
let canHold = true;            // 每个新方块只能 hold 一次,锁定后重置
let score = 0;
let level = 1;
let lines = 0;
let isPlaying = false;
let isPaused = false;
let dropCounter = 0;           // 下落计时累加器(ms)
let dropInterval = 1000;       // 当前等级下落间隔(ms)
let lastTime = 0;              // 上一帧时间戳
let animationId = null;        // rAF 句柄
let lastMoveWasRotation = false;  // T-spin 判定:最后操作是否为旋转
let lastClearWasDifficult = false; // B2B:上次消行是否为 Tetris/T-spin
let highScoreAtStart = 0;      // 本局开始时的最高分快照,用于结束时判定新纪录

// ============ 最高分持久化 ============
// 检测 localStorage 可用性(隐私模式可能抛错),不可用则降级为内存存储
const storageOk = (() => {
  try { return typeof localStorage !== 'undefined' && localStorage !== null; }
  catch (e) { return false; }
})();

function loadHighScore() {
  if (!storageOk) return 0;
  const v = parseInt(localStorage.getItem('tetris_highscore'), 10);
  return Number.isFinite(v) ? v : 0;
}
function saveHighScore(v) {
  if (!storageOk) return;
  try { localStorage.setItem('tetris_highscore', String(v)); } catch (e) { /* 忽略写入失败 */ }
}
let highScore = loadHighScore();

// ============ Web Audio 音效合成器 ============
// 用 oscillator + gain envelope 合成短音,无需音频文件
// AudioContext 延迟到首次用户交互时创建(浏览器自动播放策略)
const sfx = {
  ctx: null,
  muted: false,
  ensure() {
    if (this.ctx) {
      // 已创建但可能被浏览器挂起(如标签页后台),尝试恢复
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (e) { this.ctx = null; }
  },
  // 单音:freq 频率, dur 时长(秒), type 波形, gain 音量
  tone(freq, dur = 0.08, type = 'square', gain = 0.15) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    // 短促 ADSR:快速 attack + 指数衰减
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },
  rotate()   { this.tone(440, 0.05, 'square', 0.08); },
  move()     { this.tone(220, 0.03, 'square', 0.05); },
  lock()     { this.tone(150, 0.08, 'triangle', 0.12); },
  hardDrop() { this.tone(100, 0.1, 'sawtooth', 0.15); },
  hold()     { this.tone(330, 0.06, 'sine', 0.1); },
  levelUp()  {
    this.tone(523, 0.1, 'square', 0.12);
    setTimeout(() => this.tone(659, 0.1, 'square', 0.12), 90);
    setTimeout(() => this.tone(784, 0.15, 'square', 0.12), 180);
  },
  clear(linesCleared, isTSpin) {
    // 行数越多音调越高;T-spin 用更亮的正弦波
    if (isTSpin) {
      this.tone(660, 0.12, 'sine', 0.15);
      setTimeout(() => this.tone(880, 0.15, 'sine', 0.15), 100);
      return;
    }
    const base = 400 + linesCleared * 120;
    this.tone(base, 0.1, 'square', 0.12);
    if (linesCleared >= 2) setTimeout(() => this.tone(base * 1.5, 0.12, 'square', 0.12), 80);
    if (linesCleared >= 3) setTimeout(() => this.tone(base * 2, 0.15, 'square', 0.12), 160);
    if (linesCleared >= 4) setTimeout(() => this.tone(base * 2.5, 0.2, 'square', 0.15), 240);
  },
  gameOver() {
    this.tone(400, 0.15, 'sawtooth', 0.15);
    setTimeout(() => this.tone(300, 0.15, 'sawtooth', 0.15), 140);
    setTimeout(() => this.tone(200, 0.3, 'sawtooth', 0.15), 280);
  }
};

// ============ 棋盘与方块 ============

// 创建空棋盘
function createBoard() {
  board = [];
  for (let r = 0; r < ROWS; r++) {
    board[r] = new Array(COLS).fill(null);
  }
}

// 根据类型创建方块对象(深拷贝形状,居中生成在顶部)
function createPiece(type) {
  const tetromino = TETROMINOS[type];
  return {
    type,
    shape: tetromino.shape.map(row => [...row]),
    color: tetromino.color,
    x: Math.floor((COLS - tetromino.shape[0].length) / 2),
    y: 0,
    rotation: 0  // SRS 旋转状态:0=spawn, 1=R, 2=2, 3=L
  };
}

// 7-bag 随机:每 7 次必定包含全部 7 种方块各一次,避免长时间不出某种方块
let pieceBag = [];
function refillBag() {
  pieceBag = [...PIECE_NAMES];
  // Fisher-Yates 洗牌
  for (let i = pieceBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceBag[i], pieceBag[j]] = [pieceBag[j], pieceBag[i]];
  }
}
function randomPiece() {
  if (pieceBag.length === 0) refillBag();
  return createPiece(pieceBag.pop());
}

// ============ 颜色工具 ============

// 颜色明度调整:percent 正值变亮、负值变暗(用于方块渐变与描边)
function shadeColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const clamp = v => Math.max(0, Math.min(255, v));
  const R = clamp((num >> 16) + amt);
  const G = clamp(((num >> 8) & 0xFF) + amt);
  const B = clamp((num & 0xFF) + amt);
  return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
}

// ============ 渲染 ============

// 预渲染每种颜色+尺寸的方块到离屏 canvas,避免每帧重建渐变(高帧率下减少 GC 压力)
const blockCache = {};
function getBlockSprite(color, size) {
  const key = `${color}@${size}`;
  if (blockCache[key]) return blockCache[key];

  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const sCtx = sprite.getContext('2d');

  const gradient = sCtx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, shadeColor(color, 30));
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, shadeColor(color, -30));

  sCtx.fillStyle = gradient;
  sCtx.fillRect(1, 1, size - 2, size - 2);

  sCtx.strokeStyle = shadeColor(color, 50);
  sCtx.lineWidth = 1;
  sCtx.strokeRect(1, 1, size - 2, size - 2);

  // 左上角高光,增强立体感
  sCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  sCtx.fillRect(3, 3, size / 3, size / 3);

  blockCache[key] = sprite;
  return sprite;
}

function drawBlock(targetCtx, x, y, color, size) {
  targetCtx.drawImage(getBlockSprite(color, size), x, y);
}

// 绘制主棋盘:背景 + 网格线 + 已锁定方块
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

// 绘制当前方块(含 ghost 落点预览)
function drawPiece() {
  if (!currentPiece) return;

  // 计算 ghost 位置:从当前 y 一路下落直到碰撞
  let ghostY = currentPiece.y;
  while (!checkCollision(currentPiece.shape, currentPiece.x, ghostY + 1)) {
    ghostY++;
  }

  // 绘制 ghost(半透明)
  ctx.globalAlpha = 0.2;
  drawShapeGrid(ctx, currentPiece.shape, currentPiece.x, ghostY, currentPiece.color, BLOCK_SIZE);
  ctx.globalAlpha = 1;

  // 绘制实体方块
  drawShapeGrid(ctx, currentPiece.shape, currentPiece.x, currentPiece.y, currentPiece.color, BLOCK_SIZE);
}

// 按格子坐标绘制形状(主棋盘用:x/y 为格子索引,像素位置 = 索引 * size)
function drawShapeGrid(targetCtx, shape, gridX, gridY, color, size) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) {
        drawBlock(targetCtx, (gridX + c) * size, (gridY + r) * size, color, size);
      }
    }
  }
}

function drawNextPiece() {
  clearPreview(nextCtx, nextCanvas);
  if (nextPiece) drawPreviewPiece(nextCtx, nextCanvas, nextPiece);
}

function drawHoldPiece() {
  clearPreview(holdCtx, holdCanvas);
  if (holdPiece) drawPreviewPiece(holdCtx, holdCanvas, holdPiece);
  // hold 不可用时变暗,提示玩家本回合不能再 hold
  if (!canHold) {
    holdCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
  }
}

// 清空预览区背景
function clearPreview(c, cv) {
  c.fillStyle = 'rgba(10, 10, 26, 0.5)';
  c.fillRect(0, 0, cv.width, cv.height);
}

// 在预览 canvas 居中绘制方块(按像素偏移,与主棋盘的格子坐标不同)
function drawPreviewPiece(c, cv, piece) {
  const shape = piece.shape;
  const offsetX = (cv.width - shape[0].length * NEXT_BLOCK_SIZE) / 2;
  const offsetY = (cv.height - shape.length * NEXT_BLOCK_SIZE) / 2;
  for (let r = 0; r < shape.length; r++) {
    for (let cc = 0; cc < shape[r].length; cc++) {
      if (shape[r][cc]) {
        drawBlock(c, offsetX + cc * NEXT_BLOCK_SIZE, offsetY + r * NEXT_BLOCK_SIZE, piece.color, NEXT_BLOCK_SIZE);
      }
    }
  }
}

// ============ 碰撞与旋转 ============

// 碰撞检测:shape 在 (x,y) 是否与边界或已锁定方块重叠
function checkCollision(shape, x, y) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const newX = x + c;
      const newY = y + r;
      if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
      if (newY >= 0 && board[newY][newX]) return true;
    }
  }
  return false;
}

// 矩阵旋转:direction>0 顺时针,direction<0 逆时针
function rotate(shape, direction) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated = [];
  if (direction > 0) {
    for (let c = 0; c < cols; c++) {
      rotated[c] = [];
      for (let r = rows - 1; r >= 0; r--) rotated[c].push(shape[r][c]);
    }
  } else {
    for (let c = cols - 1; c >= 0; c--) {
      rotated[cols - 1 - c] = [];
      for (let r = 0; r < rows; r++) rotated[cols - 1 - c].push(shape[r][c]);
    }
  }
  return rotated;
}

// SRS wall kick 数据(参考 https://tetris.wiki/SRS)
// 索引 [fromState][testIndex] = [dx, dy],dy 向下为正
const SRS_KICKS_JLSTZ_CW = [
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],   // 0 -> R
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],      // R -> 2
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],       // 2 -> L
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]    // L -> 0
];
const SRS_KICKS_I_CW = [
  [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],     // 0 -> R
  [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],     // R -> 2
  [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],     // 2 -> L
  [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]]      // L -> 0
];
// 逆时针 kick 表(CW 表的对应反向转换)
const SRS_KICKS_JLSTZ_CCW = [
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],      // 0 -> L
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],    // R -> 0
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],   // 2 -> R
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]        // L -> 2
];
const SRS_KICKS_I_CCW = [
  [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],     // 0 -> L
  [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],     // R -> 0
  [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],     // 2 -> R
  [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]      // L -> 2
];

// 取对应类型+方向+状态的 kick 偏移列表
// 注:O 形在 rotatePiece 中已提前返回,此处只处理 I 和 JLSTZ
function getKicks(type, fromState, direction) {
  if (type === 'I') {
    return direction > 0 ? SRS_KICKS_I_CW[fromState] : SRS_KICKS_I_CCW[fromState];
  }
  return direction > 0 ? SRS_KICKS_JLSTZ_CW[fromState] : SRS_KICKS_JLSTZ_CCW[fromState];
}

// 旋转方块:依次尝试 kick 表中的偏移,首个不碰撞的位置生效
function rotatePiece(direction = 1) {
  if (!currentPiece || !isPlaying || isPaused) return;
  if (currentPiece.type === 'O') return;  // O 形旋转后形状不变,直接跳过

  const rotated = rotate(currentPiece.shape, direction);
  const fromState = currentPiece.rotation;
  const toState = direction > 0 ? (fromState + 1) % 4 : (fromState + 3) % 4;
  const kicks = getKicks(currentPiece.type, fromState, direction);

  for (const [dx, dy] of kicks) {
    if (!checkCollision(rotated, currentPiece.x + dx, currentPiece.y + dy)) {
      currentPiece.shape = rotated;
      currentPiece.x += dx;
      currentPiece.y += dy;
      currentPiece.rotation = toState;
      lastMoveWasRotation = true;
      sfx.rotate();
      return;
    }
  }
}

// ============ 方块操作 ============

// 平移方块;silent=true 时不播放 move 音效(供重力/hardDrop 内部调用)
function movePiece(dx, dy, silent = false) {
  if (!currentPiece || !isPlaying || isPaused) return false;
  if (checkCollision(currentPiece.shape, currentPiece.x + dx, currentPiece.y + dy)) return false;

  currentPiece.x += dx;
  currentPiece.y += dy;
  // 任何水平平移都取消 T-spin 资格(标准 T-spin 规则)
  if (dx !== 0) lastMoveWasRotation = false;
  if (!silent) sfx.move();
  return true;
}

// 硬降:直接落到底,每格 +2 分
function hardDrop() {
  if (!currentPiece || !isPlaying || isPaused) return;
  while (movePiece(0, 1, true)) score += 2;
  // hardDrop 不改变水平位置,保留 lastMoveWasRotation 状态(支持 T-spin 之后的硬降)
  updateScore();
  sfx.hardDrop();
  mergePiece();
  dropCounter = 0;
}

// T-spin 判定:T 形 + 最后操作为旋转 + 旋转中心四角至少 3 个被占据
function checkTSpin() {
  if (!currentPiece || currentPiece.type !== 'T' || !lastMoveWasRotation) return false;
  // T 形旋转中心相对 piece 左上角为 (1, 1)
  const cx = currentPiece.x + 1;
  const cy = currentPiece.y + 1;
  const corners = [
    [cx - 1, cy - 1], [cx + 1, cy - 1],
    [cx - 1, cy + 1], [cx + 1, cy + 1]
  ];
  let filled = 0;
  for (const [bx, by] of corners) {
    // 出界角落(含顶墙)或被占用都算 filled
    if (bx < 0 || bx >= COLS || by < 0 || by >= ROWS) filled++;
    else if (board[by][bx]) filled++;
  }
  return filled >= 3;
}

// ============ 消行与评分 ============

// 显示消行提示文字(浮动动画);variant 决定颜色类
function showClearText(text, variant) {
  clearTextEl.textContent = text;
  clearTextEl.className = 'clear-text';
  void clearTextEl.offsetWidth;  // 强制 reflow 以重启动画
  if (variant) clearTextEl.classList.add(variant);
  clearTextEl.classList.add('show');
}

// 锁定当前方块到棋盘,然后消行并生成新方块
function mergePiece() {
  const isTSpin = checkTSpin();

  for (let r = 0; r < currentPiece.shape.length; r++) {
    for (let c = 0; c < currentPiece.shape[r].length; c++) {
      if (!currentPiece.shape[r][c]) continue;
      const boardY = currentPiece.y + r;
      const boardX = currentPiece.x + c;
      if (boardY >= 0) board[boardY][boardX] = currentPiece.color;
    }
  }

  sfx.lock();
  clearLines(isTSpin);
  spawnPiece();
}

// 消行计分:支持普通消行、Tetris、T-spin、B2B 加成
function clearLines(isTSpin) {
  let linesCleared = 0;

  // 从下往上扫描,整行填满则删除并在顶部补空行
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(cell => cell !== null)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(null));
      linesCleared++;
      r++;  // 补行后该索引仍是新行,需重新检查
    }
  }

  // T-spin 不消行:仍给少量分数并提示
  if (linesCleared === 0 && isTSpin) {
    score += 400 * level;
    showClearText(i18n.t('tspin'), 'tspin');
    sfx.clear(0, true);
    lastClearWasDifficult = true;
    updateScore();
    return;
  }

  if (linesCleared === 0) return;

  // 基础分:普通消行 / T-spin 消行 / Tetris
  const basePoints  = [0, 100, 300, 500, 800];
  const tspinPoints = [0, 800, 1200, 1600];
  let earned;
  let isDifficult = false;
  let label = '';

  if (isTSpin) {
    earned = tspinPoints[linesCleared] * level;
    isDifficult = true;
    label = linesCleared === 1 ? i18n.t('tspinSingle')
          : linesCleared === 2 ? i18n.t('tspinDouble')
          : linesCleared === 3 ? i18n.t('tspinTriple') : '';
  } else if (linesCleared === 4) {
    earned = basePoints[4] * level;
    isDifficult = true;
    label = i18n.t('tetris');
  } else {
    earned = basePoints[linesCleared] * level;
    label = ['', i18n.t('single'), i18n.t('double'), i18n.t('triple')][linesCleared];
  }

  // B2B 加成:连续困难消行(Tetris 或 T-spin)给 1.5x
  if (isDifficult && lastClearWasDifficult) {
    earned = Math.floor(earned * 1.5);
    label = i18n.t('b2b') + ' ' + label;
  }

  score += earned;
  lines += linesCleared;
  lastClearWasDifficult = isDifficult;

  sfx.clear(linesCleared, isTSpin);

  // 升级:每 10 行升 1 级,下落间隔缩短(最低 100ms)
  const newLevel = Math.floor(lines / 10) + 1;
  if (newLevel > level) {
    level = newLevel;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    sfx.levelUp();
  }

  if (label) showClearText(label, isTSpin ? 'tspin' : (linesCleared === 4 ? 'tetris' : ''));
  updateScore();
}

// ============ 方块生成与 Hold ============

// 生成新方块;若出生即碰撞则游戏结束
function spawnPiece() {
  currentPiece = nextPiece || randomPiece();
  nextPiece = randomPiece();
  canHold = true;
  lastMoveWasRotation = false;  // 新方块无旋转状态,避免误判 T-spin

  if (checkCollision(currentPiece.shape, currentPiece.x, currentPiece.y)) {
    gameOver();
    return;
  }

  drawNextPiece();
  drawHoldPiece();
}

// Hold:暂存当前方块。空槽则放入并从 next 取新方块;已有暂存则两者交换
function holdCurrent() {
  if (!currentPiece || !isPlaying || isPaused || !canHold) return;

  const heldType = currentPiece.type;
  if (holdPiece) {
    const swapType = holdPiece.type;
    holdPiece = createPiece(heldType);
    currentPiece = createPiece(swapType);
  } else {
    holdPiece = createPiece(heldType);
    currentPiece = nextPiece;
    nextPiece = randomPiece();
    drawNextPiece();
  }
  canHold = false;
  lastMoveWasRotation = false;  // 交换/取出的新方块无旋转状态
  drawHoldPiece();
  sfx.hold();
}

// ============ UI 更新 ============

function updateScore() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;

  // 实时同步最高分:本局超过历史最高时立即保存并更新显示
  if (score > highScore) {
    highScore = score;
    saveHighScore(highScore);
  }
  highScoreEl.textContent = highScore;

  // 分数变化时触发弹跳动画
  scoreEl.classList.remove('bump');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('bump');
}

// 渲染游戏结束的完整信息(供 gameOver 与语言切换复用)
function renderGameOverMessage(isNewRecord) {
  const recordLine = isNewRecord
    ? '\n' + i18n.t('overlayNewRecord')
    : '\n' + i18n.t('overlayHighScore') + ': ' + highScore;
  overlayMsg.textContent =
    i18n.t('overlayFinalScore') + ': ' + score + '\n'
    + i18n.t('overlayLevel') + ': ' + level + '\n'
    + i18n.t('overlayLines') + ': ' + lines + recordLine + '\n'
    + i18n.t('overlayRestart');
}

// 显示"准备开始"遮罩并重置按钮到初始态(供 init / resetGame 复用)
function showReadyOverlay() {
  overlayTitle.textContent = i18n.t('overlayReady');
  overlayMsg.textContent = i18n.t('overlayReadyMsg');
  overlay.classList.remove('hidden');
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = i18n.t('pauseBtn');
}

// ============ 游戏流程 ============

function gameOver() {
  isPlaying = false;
  cancelAnimationFrame(animationId);

  // 新纪录判定:与本局开始时的最高分快照比较
  // (updateScore 已在游戏中实时保存,此处只需判定显示)
  const isNewRecord = score > highScoreAtStart;

  overlayTitle.textContent = i18n.t('overlayGameOver');
  renderGameOverMessage(isNewRecord);
  overlay.classList.remove('hidden');

  sfx.gameOver();

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = i18n.t('pauseBtn');
}

function startGame() {
  createBoard();
  score = 0;
  level = 1;
  lines = 0;
  dropInterval = 1000;
  holdPiece = null;
  canHold = true;
  lastMoveWasRotation = false;
  lastClearWasDifficult = false;
  highScoreAtStart = highScore;  // 快照本局开始时的最高分,用于结束时判定新纪录
  isPlaying = true;
  isPaused = false;

  updateScore();

  nextPiece = randomPiece();
  spawnPiece();

  overlay.classList.add('hidden');

  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pauseBtn.textContent = i18n.t('pauseBtn');

  lastTime = 0;
  dropCounter = 0;
  gameLoop();
}

function togglePause() {
  if (!isPlaying) return;

  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? i18n.t('resumeBtn') : i18n.t('pauseBtn');

  if (isPaused) {
    overlayTitle.textContent = i18n.t('overlayPause');
    overlayMsg.textContent = i18n.t('overlayPauseMsg');
    overlay.classList.remove('hidden');
    cancelAnimationFrame(animationId);
  } else {
    overlay.classList.add('hidden');
    lastTime = 0;       // 重置时间,避免恢复后第一帧 dropCounter 跳变
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
  holdPiece = null;
  canHold = true;
  lastMoveWasRotation = false;
  lastClearWasDifficult = false;
  dropInterval = 1000;

  updateScore();
  drawBoard();
  drawNextPiece();
  drawHoldPiece();

  showReadyOverlay();
}

// 主循环:rAF 驱动,按 dropInterval 下落方块
function gameLoop(time = 0) {
  if (!isPlaying || isPaused) return;

  // 第一帧或暂停恢复后 lastTime=0,只记录时间不累加,避免 dropCounter 跳变
  if (lastTime === 0) {
    lastTime = time;
    animationId = requestAnimationFrame(gameLoop);
    return;
  }

  // 限制单帧 deltaTime 上限,防止后台标签页切回时方块瞬移
  const deltaTime = Math.min(time - lastTime, 100);
  lastTime = time;
  dropCounter += deltaTime;

  if (dropCounter > dropInterval) {
    if (!movePiece(0, 1, true)) mergePiece();  // 下落失败则锁定
    dropCounter = 0;
  }

  drawBoard();
  drawPiece();

  animationId = requestAnimationFrame(gameLoop);
}

// ============ 初始化与事件绑定 ============

// 移动端单次触发按钮绑定:touchstart 即时响应,click 供桌面端,合成事件跳过避免双触发
function bindTapButton(id, action) {
  const el = document.getElementById(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }, { passive: false });
  el.addEventListener('click', (e) => { if (e.detail !== 0) action(); });
}

function init() {
  createBoard();
  drawBoard();
  drawNextPiece();
  drawHoldPiece();
  updateScore();

  // ===== 语言菜单 =====
  const langMenuBtn   = document.getElementById('langMenuBtn');
  const langMenuList  = document.getElementById('langMenuList');
  const langMenuLabel = document.getElementById('langMenuLabel');

  // 渲染语言列表项并高亮当前语言
  function renderLangMenu() {
    langMenuList.innerHTML = '';
    const current = i18n.getLang();
    i18n.getSupported().forEach(code => {
      const li = document.createElement('li');
      li.className = 'lang-menu-item' + (code === current ? ' active' : '');
      li.setAttribute('role', 'menuitemradio');
      li.setAttribute('aria-checked', code === current ? 'true' : 'false');
      li.dataset.lang = code;
      li.innerHTML = `<span>${i18n.getLangName(code)}</span><span class="lang-menu-item-check">✓</span>`;
      li.addEventListener('click', () => {
        i18n.setLang(code);
        closeLangMenu();
      });
      langMenuList.appendChild(li);
    });
    langMenuLabel.textContent = i18n.getLangName(current);
  }

  function openLangMenu() {
    langMenuList.hidden = false;
    langMenuBtn.setAttribute('aria-expanded', 'true');
  }
  function closeLangMenu() {
    langMenuList.hidden = true;
    langMenuBtn.setAttribute('aria-expanded', 'false');
  }

  langMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (langMenuList.hidden) openLangMenu(); else closeLangMenu();
  });
  // 点击菜单外部关闭
  document.addEventListener('click', (e) => {
    if (!langMenuList.hidden && !langMenuList.contains(e.target) && e.target !== langMenuBtn) {
      closeLangMenu();
    }
  });
  // Esc 关闭并归还焦点
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !langMenuList.hidden) {
      closeLangMenu();
      langMenuBtn.focus();
    }
  });

  // 首次应用静态文本翻译(覆盖 HTML 中的中文默认值)
  renderLangMenu();
  i18n.applyTranslations();
  showReadyOverlay();

  // 语言变化时刷新菜单 + 当前可见的动态文本
  document.addEventListener('langchange', () => {
    renderLangMenu();
    // 游戏中 overlay 隐藏,无需更新;仅在非游戏或暂停态刷新 overlay 文本
    if (!isPlaying && !overlay.classList.contains('hidden')) {
      if (startBtn.disabled) {
        // 游戏结束态:重新渲染完整结束信息(含动态分数)
        overlayTitle.textContent = i18n.t('overlayGameOver');
        renderGameOverMessage(score > highScoreAtStart);
      } else {
        // 准备开始态
        overlayTitle.textContent = i18n.t('overlayReady');
        overlayMsg.textContent = i18n.t('overlayReadyMsg');
      }
    }
    if (isPaused) {
      overlayTitle.textContent = i18n.t('overlayPause');
      overlayMsg.textContent = i18n.t('overlayPauseMsg');
    }
    pauseBtn.textContent = isPaused ? i18n.t('resumeBtn') : i18n.t('pauseBtn');
  });

  // ===== 音频初始化 =====
  // 首次用户交互时创建 AudioContext(浏览器自动播放策略要求)
  const initAudio = () => sfx.ensure();
  document.addEventListener('keydown', initAudio, { once: true });
  document.addEventListener('pointerdown', initAudio, { once: true });

  // 静音切换
  muteBtn.addEventListener('click', () => {
    sfx.ensure();
    sfx.muted = !sfx.muted;
    muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
  });

  // ===== 键盘控制 =====
  document.addEventListener('keydown', (e) => {
    // 阻止方向键/空格滚动页面
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();

    // 全局键:空格(开始/硬降)、P(暂停)、C(hold)
    if (e.key === ' ') {
      if (!isPlaying) startGame();
      else if (!isPaused) hardDrop();
      return;
    }
    if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
    if (e.key === 'c' || e.key === 'C') { holdCurrent(); return; }

    if (!isPlaying || isPaused) return;

    switch (e.key) {
      case 'ArrowLeft':  movePiece(-1, 0); break;
      case 'ArrowRight': movePiece(1, 0); break;
      case 'ArrowDown':
        if (movePiece(0, 1)) { score += 1; updateScore(); }
        break;
      case 'ArrowUp':
      case 'x':
      case 'X':
        rotatePiece(1);   // 顺时针
        break;
      case 'z':
      case 'Z':
        rotatePiece(-1);  // 逆时针
        break;
    }
  });

  // ===== 按钮控制 =====
  startBtn.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', togglePause);
  resetBtn.addEventListener('click', resetGame);

  // ===== 移动端触控 =====
  // 左/右/下:支持长按连发(首次延迟 300ms,之后每 80ms 触发)
  const repeatable = {
    leftBtn:  () => movePiece(-1, 0),
    rightBtn: () => movePiece(1, 0),
    downBtn:  () => { if (movePiece(0, 1)) { score += 1; updateScore(); } }
  };
  const repeatTimers = {};

  Object.keys(repeatable).forEach(id => {
    const btn = document.getElementById(id);
    const action = repeatable[id];
    const start = (e) => {
      e.preventDefault();
      action();
      repeatTimers[id] = { initial: null, repeat: null };
      repeatTimers[id].initial = setTimeout(() => {
        repeatTimers[id].repeat = setInterval(action, 80);
      }, 300);
    };
    const stop = () => {
      if (!repeatTimers[id]) return;
      clearTimeout(repeatTimers[id].initial);
      clearInterval(repeatTimers[id].repeat);
      repeatTimers[id] = null;
    };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
    btn.addEventListener('click', (e) => {
      // 触屏端由 touchstart 处理;e.detail===0 表示合成 click,跳过避免双触发
      if (e.detail === 0) return;
      action();
    });
  });

  // 旋转按钮:短按顺时针,长按(>400ms)逆时针
  const rotateBtnEl = document.getElementById('rotateBtn');
  let rotatePressTimer = null;
  let rotateDidLong = false;
  rotateBtnEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    rotateDidLong = false;
    rotatePressTimer = setTimeout(() => {
      rotateDidLong = true;
      rotatePiece(-1);
    }, 400);
  }, { passive: false });
  const rotateEnd = () => {
    if (rotatePressTimer) {
      clearTimeout(rotatePressTimer);
      rotatePressTimer = null;
    }
  };
  rotateBtnEl.addEventListener('touchend', (e) => {
    e.preventDefault();  // 阻止合成 click,避免与下方 click 监听重复触发
    rotateEnd();
    if (!rotateDidLong) rotatePiece(1);
  });
  rotateBtnEl.addEventListener('touchcancel', rotateEnd);
  rotateBtnEl.addEventListener('click', (e) => {
    if (e.detail === 0) return;  // 桌面端 click 走顺时针
    rotatePiece(1);
  });

  // 落底 / Hold:单次触发
  bindTapButton('dropBtn', hardDrop);
  bindTapButton('holdBtn', holdCurrent);
}

init();

})();
