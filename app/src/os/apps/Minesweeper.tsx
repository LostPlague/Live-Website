import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Minesweeper.css';

/* ═══════════════════════════════════════════════════════════════
   Classic Windows 95 Minesweeper — Fully Playable
   9×9 Beginner grid, 10 mines, first-click safe
   ═══════════════════════════════════════════════════════════════ */

const ROWS = 9;
const COLS = 9;
const MINES = 10;

type CellState = 'hidden' | 'revealed' | 'flagged';

interface Cell {
  isMine: boolean;
  adjacent: number;
  state: CellState;
  exploded?: boolean; // the mine that killed you
}

type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

// ─── Board Creation ───────────────────────────────────────────
function createEmptyBoard(): Cell[][] {
  const board: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push({ isMine: false, adjacent: 0, state: 'hidden' });
    }
    board.push(row);
  }
  return board;
}

function placeMines(board: Cell[][], safeR: number, safeC: number): void {
  // Place MINES randomly, avoiding the first-click cell and its neighbors
  const safeCells = new Set<string>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeR + dr;
      const nc = safeC + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        safeCells.add(`${nr},${nc}`);
      }
    }
  }

  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (!board[r][c].isMine && !safeCells.has(`${r},${c}`)) {
      board[r][c].isMine = true;
      placed++;
    }
  }

  // Calculate adjacency counts
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].isMine) {
            count++;
          }
        }
      }
      board[r][c].adjacent = count;
    }
  }
}

// ─── Deep Clone ───────────────────────────────────────────────
function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map(row => row.map(cell => ({ ...cell })));
}

// ─── Flood Fill ───────────────────────────────────────────────
function floodFill(board: Cell[][], r: number, c: number): void {
  // Iterative BFS flood-fill to avoid stack overflow on large reveals
  const queue: [number, number][] = [[r, c]];

  while (queue.length > 0) {
    const [cr, cc] = queue.shift()!;

    if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) continue;
    if (board[cr][cc].state !== 'hidden') continue;
    if (board[cr][cc].isMine) continue;

    board[cr][cc].state = 'revealed';

    // If this cell has 0 adjacent mines, expand to all 8 neighbors
    if (board[cr][cc].adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          queue.push([cr + dr, cc + dc]);
        }
      }
    }
  }
}

// ─── Win Check ────────────────────────────────────────────────
function checkWin(board: Cell[][]): boolean {
  // Win when every non-mine cell is revealed
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c].isMine && board[r][c].state !== 'revealed') {
        return false;
      }
    }
  }
  return true;
}

// ─── Audio Bridge ─────────────────────────────────────────────
function fireClick(): void {
  try {
    window.parent.postMessage({ type: 'mouseDown' }, '*');
    setTimeout(() => {
      window.parent.postMessage({ type: 'mouseUp' }, '*');
    }, 30);
  } catch {
    // Silently ignore if parent is unreachable
  }
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════
export const Minesweeper: React.FC = () => {
  const [board, setBoard] = useState<Cell[][]>(() => createEmptyBoard());
  const [status, setStatus] = useState<GameStatus>('idle');
  const [flagsUsed, setFlagsUsed] = useState(0);
  const [timer, setTimer] = useState(0);
  const minesPlacedRef = useRef(false);

  const minesRemaining = MINES - flagsUsed;

  // ── Timer Effect ──
  useEffect(() => {
    if (status !== 'playing') return;
    const interval = setInterval(() => {
      setTimer(t => Math.min(t + 1, 999));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // ── Left Click ──
  const handleLeftClick = useCallback((r: number, c: number) => {
    if (status === 'won' || status === 'lost') return;

    const newBoard = cloneBoard(board);
    const cell = newBoard[r][c];

    // Can't click revealed or flagged cells
    if (cell.state === 'revealed' || cell.state === 'flagged') return;

    fireClick();

    // First click: place mines (guaranteeing safe first click)
    if (!minesPlacedRef.current) {
      placeMines(newBoard, r, c);
      minesPlacedRef.current = true;
      setStatus('playing');
    }

    if (newBoard[r][c].isMine) {
      // ── LOSE ──
      // Reveal all mines, mark the clicked mine as exploded
      newBoard[r][c].exploded = true;
      for (let rr = 0; rr < ROWS; rr++) {
        for (let cc = 0; cc < COLS; cc++) {
          if (newBoard[rr][cc].isMine) {
            newBoard[rr][cc].state = 'revealed';
          }
        }
      }
      setBoard(newBoard);
      setStatus('lost');
      return;
    }

    // ── REVEAL ──
    floodFill(newBoard, r, c);

    // ── WIN CHECK ──
    if (checkWin(newBoard)) {
      // Auto-flag all remaining mines on win
      for (let rr = 0; rr < ROWS; rr++) {
        for (let cc = 0; cc < COLS; cc++) {
          if (newBoard[rr][cc].isMine && newBoard[rr][cc].state === 'hidden') {
            newBoard[rr][cc].state = 'flagged';
          }
        }
      }
      setBoard(newBoard);
      setFlagsUsed(MINES);
      setStatus('won');
      return;
    }

    setBoard(newBoard);
  }, [board, status]);

  // ── Right Click (Flag Toggle) ──
  const handleRightClick = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (status === 'won' || status === 'lost') return;
    if (status === 'idle') return; // can't flag before first reveal

    const newBoard = cloneBoard(board);
    const cell = newBoard[r][c];

    if (cell.state === 'revealed') return;

    fireClick();

    if (cell.state === 'hidden') {
      cell.state = 'flagged';
      setFlagsUsed(f => f + 1);
    } else if (cell.state === 'flagged') {
      cell.state = 'hidden';
      setFlagsUsed(f => f - 1);
    }

    setBoard(newBoard);
  }, [board, status]);

  // ── Restart ──
  const handleRestart = useCallback(() => {
    setBoard(createEmptyBoard());
    setStatus('idle');
    setFlagsUsed(0);
    setTimer(0);
    minesPlacedRef.current = false;
    fireClick();
  }, []);

  // ── Smiley Face ──
  const smileyFace = status === 'won' ? '😎' : status === 'lost' ? '💀' : '🙂';

  // ── Render Cell Content ──
  const renderCell = (cell: Cell) => {
    if (cell.state === 'flagged') {
      return '🚩';
    }
    if (cell.state === 'revealed') {
      if (cell.isMine) {
        return '💣';
      }
      if (cell.adjacent > 0) {
        return <span className={`ms-num ms-num-${cell.adjacent}`}>{cell.adjacent}</span>;
      }
      return null; // empty revealed cell
    }
    return null; // hidden cell
  };

  // ── Cell Class ──
  const getCellClass = (cell: Cell): string => {
    const classes = ['ms-cell'];
    if (cell.state === 'revealed') {
      classes.push('ms-cell-revealed');
      if (cell.exploded) {
        classes.push('ms-cell-exploded');
      }
    } else if (cell.state === 'flagged') {
      classes.push('ms-cell-flagged');
    }
    return classes.join(' ');
  };

  return (
    <div className="ms-window">
      <div className="ms-menu">
        <span>Game</span>
        <span>Help</span>
      </div>
      <div className="ms-frame">
        <div className="ms-header">
          <div className="ms-counter">
            {String(Math.max(minesRemaining, -99)).padStart(3, '0')}
          </div>
          <button
            className="ms-smiley"
            onClick={handleRestart}
            type="button"
          >
            {smileyFace}
          </button>
          <div className="ms-counter">
            {String(timer).padStart(3, '0')}
          </div>
        </div>
        <div className="ms-grid">
          {board.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                className={getCellClass(cell)}
                onClick={() => handleLeftClick(r, c)}
                onContextMenu={(e) => handleRightClick(e, r, c)}
                disabled={status === 'won' || status === 'lost'}
                type="button"
              >
                {renderCell(cell)}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
