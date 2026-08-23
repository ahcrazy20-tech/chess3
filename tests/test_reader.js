// Functional test of the NEW reader.js orientation logic with a mocked DOM.
const fs = require('fs');
const vm = require('vm');

const SRC = fs.readFileSync('/tmp/reader_check.js', 'utf8');
// placeholders already replaced in reader_check.js: bridge=b, flag=f, start=s, interval=700

function pieceNode(className, style, dataPiece, dataSquare) {
  return {
    className,
    getAttribute(name) {
      if (name === 'style') return style || '';
      if (name === 'data-piece') return dataPiece || null;
      if (name === 'data-square') return dataSquare || null;
      return null;
    }
  };
}

// Build chess.com-style pieces (absolute square-XY classes)
function ccPieces() {
  const P = [];
  const back = ['r','n','b','q','k','b','n','r']; // files a..h rank8
  back.forEach((p, i) => P.push(pieceNode(`piece ${p === 'k' ? 'king' : p === 'q' ? 'queen' : p === 'r' ? 'rook' : p === 'b' ? 'bishop' : 'knight'} square-${i + 1}8 black`)));
  for (let i = 1; i <= 8; i++) P.push(pieceNode(`piece pawn square-${i}7 black`));
  for (let i = 1; i <= 8; i++) P.push(pieceNode(`piece pawn square-${i}2 white`));
  const wback = ['R','N','B','Q','K','B','N','R'];
  wback.forEach((p, i) => P.push(pieceNode(`piece ${p === 'K' ? 'king' : p === 'Q' ? 'queen' : p === 'R' ? 'rook' : p === 'B' ? 'bishop' : 'knight'} square-${i + 1}1 white`)));
  return P;
}
function ccMove(pieces, from, to) { // from/to like 'square-52'
  const node = pieces.find(p => p.className.includes(from));
  node.className = node.className.replace(from, to);
}

// Build lichess-style pieces. percent: translate per-square units.
function liPieces(flipped) {
  const P = [];
  function sq(fileIdx /*0=a*/, rankRow /*0=rank8 top in normal view*/) {
    // normal view: x = fileIdx*100%, y = rankRow*100%
    // flipped view: x = (7-fileIdx)*100%, y = (7-rankRowFromRank1Top?) ...
    return null;
  }
  const place = (letter, file, rank) => { // file 1-8, rank 1-8 (absolute)
    let x, y;
    if (!flipped) { x = (file - 1) * 100; y = (8 - rank) * 100; }        // top-left=a8
    else { x = (8 - file) * 100; y = (rank - 1) * 100; }                 // top-left=h1
    const color = letter === letter.toUpperCase() ? 'white' : 'black';
    const name = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[letter.toLowerCase()];
    P.push(pieceNode(`piece ${name} ${color}`, `transform: translate(${x}%, ${y}%)`));
  };
  const back = ['r','n','b','q','k','b','n','r'];
  back.forEach((p, i) => place(p, i + 1, 8));
  for (let i = 1; i <= 8; i++) place('p', i, 7);
  for (let i = 1; i <= 8; i++) place('P', i, 2);
  back.forEach((p, i) => place(p.toUpperCase(), i + 1, 1));
  return P;
}
function liMove(pieces, fromFile, fromRank, toFile, toRank, flipped) {
  let fx, fy;
  if (!flipped) { fx = (fromFile - 1) * 100; fy = (8 - fromRank) * 100; }
  else { fx = (8 - fromFile) * 100; fy = (fromRank - 1) * 100; }
  let tx, ty;
  if (!flipped) { tx = (toFile - 1) * 100; ty = (8 - toRank) * 100; }
  else { tx = (8 - toFile) * 100; ty = (toRank - 1) * 100; }
  const fromStyle = `transform: translate(${fx}%, ${fy}%)`;
  const node = pieces.find(p => p.getAttribute('style') === fromStyle);
  if (!node) throw new Error('liMove: piece not found at ' + fromStyle);
  node.getAttribute = (name) => name === 'style' ? `transform: translate(${tx}%, ${ty}%)` : null;
}

const START_GRID = 'rnbqkbnr' + 'pppppppp' + '.'.repeat(32) + 'PPPPPPPP' + 'RNBQKBNR';

function runScenario(name, board, extraSetup) {
  const payloads = [];
  const timeouts = [];
  let tickFn = null;
  const sandbox = {
    document: {
      querySelector: (sel) => board,
      querySelectorAll: (sel) => board.plyNodes || [],
      documentElement: { },
    },
    window: {},
    MutationObserver: function () { this.observe = () => {}; },
    setInterval: (fn) => { tickFn = fn; return 1; },
    clearInterval: () => {},
    setTimeout: (fn) => { timeouts.push(fn); return 1; },
    Date, Math, String, parseInt, isNaN, JSON,
  };
  sandbox.window = sandbox;
  sandbox.window.webkit = { messageHandlers: { b: { postMessage: (p) => payloads.push(p) } } };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  timeouts[0]();          // triggers window.s() -> setInterval
  if (!tickFn) throw new Error(name + ': tick never installed');
  if (extraSetup) extraSetup();
  return {
    payloads,
    tick: () => tickFn(),
  };
}

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail === undefined ? '' : '— ' + detail); }
}

// ---------- Scenario 1: chess.com UNFLIPPED + e2e4 ----------
{
  console.log('S1: chess.com unflipped, e2e4');
  const pieces = ccPieces();
  const board = {
    tagName: 'WC-CHESS-BOARD',
    classList: { contains: () => false },
    parentElement: null,
    querySelectorAll: () => pieces,
    plyNodes: [{ getAttribute: () => '0' }],
    offsetWidth: 0,
  };
  const s = runScenario('s1', board);
  s.tick();
  let p = s.payloads.at(-1);
  check('grid = start (absolute)', p.grid === START_GRID, p.grid);
  check('flipped=false', p.flipped === false);
  check('side=w at ply0', p.sideToMove === 'w');
  ccMove(pieces, 'square-52', 'square-54');
  board.plyNodes = [{ getAttribute: () => '1' }];
  s.tick();
  p = s.payloads.at(-1);
  check('after e2e4: UCI=e2e4', p.lastMoveUCI === 'e2e4', p.lastMoveUCI);
  check('sideToMove=b', p.sideToMove === 'b');
  check('grid has P on e4', p.grid === 'rnbqkbnr' + 'pppppppp' + '.'.repeat(16) + '....P...' + '.'.repeat(8) + 'PPPP.PPP' + 'RNBQKBNR', p.grid);
}

// ---------- Scenario 2: chess.com FLIPPED (playing black) ----------
{
  console.log('S2: chess.com FLIPPED start position');
  const pieces = ccPieces(); // square-XY stays absolute when board flips
  const board = {
    tagName: 'WC-CHESS-BOARD',
    classList: { contains: (c) => c === 'flipped' },
    parentElement: null,
    querySelectorAll: () => pieces,
    plyNodes: [{ getAttribute: () => '0' }],
    offsetWidth: 0,
  };
  const s = runScenario('s2', board);
  s.tick();
  const p = s.payloads.at(-1);
  check('grid = start (NOT mirrored!)', p.grid === START_GRID, p.grid);
  check('flipped=true (color detect)', p.flipped === true);
  check('flippedConfident=true', p.flippedConfident === true);
}

// ---------- Scenario 3: chess.com flipped + black plays e7e5 ----------
{
  console.log('S3: chess.com flipped, black e7e5');
  const pieces = ccPieces();
  const board = {
    tagName: 'WC-CHESS-BOARD',
    classList: { contains: (c) => c === 'flipped' },
    parentElement: null,
    querySelectorAll: () => pieces,
    plyNodes: [{ getAttribute: () => '0' }, { getAttribute: () => '1' }],
    offsetWidth: 0,
  };
  const s = runScenario('s3', board);
  s.tick();
  ccMove(pieces, 'square-57', 'square-55');
  board.plyNodes = [{ getAttribute: () => '1' }, { getAttribute: () => '2' }];
  s.tick();
  const p = s.payloads.at(-1);
  check('UCI=e7e5', p.lastMoveUCI === 'e7e5', p.lastMoveUCI);
  check('sideToMove=w (ply2)', p.sideToMove === 'w');
  check('pawn on e5, e2 intact', p.grid[8 * 3 + 4] === 'p' && p.grid[8 * 6 + 4] === 'P' && p.grid[8 * 1 + 4] === '.', p.grid);
}

// ---------- Scenario 4: lichess FLIPPED (transform %) ----------
{
  console.log('S4: lichess flipped start (transform %)');
  const pieces = liPieces(true);
  const board = {
    tagName: 'CG-BOARD',
    classList: { contains: () => false },
    parentElement: null,
    querySelectorAll: () => pieces,
    plyNodes: [],
    offsetWidth: 0,
  };
  const s = runScenario('s4', board);
  s.tick();
  const p = s.payloads.at(-1);
  check('grid = start (un-mirrored to absolute)', p.grid === START_GRID, p.grid);
  check('flipped=true via king heuristic', p.flipped === true && p.flippedConfident === true);
}

// ---------- Scenario 5: lichess unflipped + e2e4 ----------
{
  console.log('S5: lichess unflipped, e2e4');
  const pieces = liPieces(false);
  const board = {
    tagName: 'CG-BOARD',
    classList: { contains: () => false },
    parentElement: null,
    querySelectorAll: () => pieces,
    plyNodes: [],
    offsetWidth: 0,
  };
  const s = runScenario('s5', board);
  s.tick();
  check('start grid', s.payloads.at(-1).grid === START_GRID);
  check('flipped=false', s.payloads.at(-1).flipped === false);
  liMove(pieces, 5, 2, 5, 4, false);
  s.tick();
  const p = s.payloads.at(-1);
  check('UCI=e2e4', p.lastMoveUCI === 'e2e4', p.lastMoveUCI);
  check('sideToMove=b (diff-based)', p.sideToMove === 'b', p.sideToMove);
}

// ---------- Scenario 6: lichess flipped + black e7e5 ----------
{
  console.log('S6: lichess flipped, black e7e5');
  const pieces = liPieces(true);
  const board = {
    tagName: 'CG-BOARD',
    classList: { contains: () => false },
    parentElement: null,
    querySelectorAll: () => pieces,
    plyNodes: [],
    offsetWidth: 0,
  };
  const s = runScenario('s6', board);
  s.tick();
  liMove(pieces, 5, 7, 5, 5, true);
  s.tick();
  const p = s.payloads.at(-1);
  check('UCI=e7e5', p.lastMoveUCI === 'e7e5', p.lastMoveUCI);
  check('sideToMove=w', p.sideToMove === 'w', p.sideToMove);
  check('pawn on e5, e2 intact', p.grid[8 * 3 + 4] === 'p' && p.grid[8 * 6 + 4] === 'P' && p.grid[8 * 1 + 4] === '.', p.grid);
}

// ---------- Scenario 7: px transforms (generic board, 512px) ----------
{
  console.log('S7: px transform board (512px), white king e1');
  const mk = (x, y, cls) => pieceNode(cls, `transform: translate(${x}px, ${y}px)`);
  const pieces = [];
  // white king e1 -> x=256 y=448 ; black king e8 -> x=256 y=0
  pieces.push(mk(256, 448, 'piece king white'));
  pieces.push(mk(256, 0, 'piece king black'));
  pieces.push(mk(0, 384, 'piece rook white'));
  pieces.push(mk(448, 64, 'piece rook black'));
  const board = {
    tagName: 'DIV',
    classList: { contains: () => false },
    parentElement: null,
    querySelectorAll: () => pieces,
    plyNodes: [],
    offsetWidth: 512,
  };
  const s = runScenario('s7', board);
  s.tick();
  const p = s.payloads.at(-1);
  const g = p.grid;
  check('K on e1', g[7 * 8 + 4] === 'K', g);
  check('k on e8', g[0 * 8 + 4] === 'k', g);
  check('R at a2 / r at h7 (as placed)', g[6 * 8 + 0] === 'R' && g[1 * 8 + 7] === 'r', g);
}

console.log(failures === 0 ? '\nALL TESTS PASSED ✅' : `\n${failures} FAILURES ❌`);
process.exit(failures === 0 ? 0 : 1);
