/**
 * Client-side Cinema Layout Builder
 * Mirrors the backend layout builder for offline/demo mode.
 */

export const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];
export const VIP_ROWS = ['E','F','G','H'];
export const VIP_COLS = [12, 13, 14, 15];
export const DISABILITY_ROWS = ['A', 'B'];

function getRowColumns(row) {
  const mainBody = Array.from({ length: 20 }, (_, i) => i + 5);
  const sidePresence = {
    A: { left: [1,2,3,4], right: [25,26,27,28] },
    B: { left: [1,2,3,4], right: [25,26,27,28] },
    C: { left: [1,2,3,4], right: [25,26,27,28] },
    D: { left: [1,2,3,4], right: [25,26,27,28] },
    E: { left: [1,2,3,4], right: [25,26,27,28] },
    F: { left: [1,2,3,4], right: [25,26,27,28] },
    G: { left: [1,2,3,4], right: [25,26,27,28] },
    H: { left: [1,2,3,4], right: [25,26,27,28] },
    I: { left: [2,3,4],   right: [25,26,27] },
    J: { left: [2,3,4],   right: [25,26,27] },
    K: { left: [2,3,4],   right: [25,26,27] },
    L: { left: [3,4],     right: [25,26] },
    M: { left: [3,4],     right: [25,26] },
    N: { left: [3,4],     right: [25,26] },
    O: { left: [4],       right: [25] },
  };
  const sides = sidePresence[row] || { left: [], right: [] };
  return [...sides.left, ...mainBody, ...sides.right].sort((a, b) => a - b);
}

function isVipSeat(row, col) {
  return VIP_ROWS.includes(row) && VIP_COLS.includes(col);
}

function generateDisabilitySeats() {
  return Array.from({ length: 6 }, (_, i) => ({ row: 'A', col: 5 + i }));
}

function generateBrokenSeats(seats) {
  const eligible = seats.filter(s =>
    !DISABILITY_ROWS.includes(s.row) &&
    s.type !== 'disability' &&
    s.type !== 'vip'
  );
  const brokenCount = Math.floor(Math.random() * 5) + 6;
  const broken = [];
  const brokenByRow = {};
  const brokenSet = new Set();
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);

  for (const seat of shuffled) {
    if (broken.length >= brokenCount) break;
    const rowKey = seat.row;
    const seatKey = `${seat.row}-${seat.number}`;
    if ((brokenByRow[rowKey] || 0) >= 2) continue;
    const leftKey = `${seat.row}-${seat.number - 1}`;
    const rightKey = `${seat.row}-${seat.number + 1}`;
    if (brokenSet.has(leftKey) || brokenSet.has(rightKey)) continue;
    broken.push(seat);
    brokenSet.add(seatKey);
    brokenByRow[rowKey] = (brokenByRow[rowKey] || 0) + 1;
  }
  return broken;
}

export function buildInMemoryLayout(sessionId = 'default') {
  const disabilitySeats = generateDisabilitySeats();
  const seats = [];

  for (const row of ROWS) {
    const cols = getRowColumns(row);
    for (const col of cols) {
      const isDisability = disabilitySeats.some(d => d.row === row && d.col === col);
      let type = 'regular';
      if (isDisability) type = 'disability';
      else if (isVipSeat(row, col)) type = 'vip';

      seats.push({
        _id: `${row}_${col}`,
        row,
        number: col,
        type,
        status: 'available',
        sessionId,
        bookingId: null,
        qualityScore: 0
      });
    }
  }

  // Mark broken seats
  const brokenCandidates = generateBrokenSeats(seats);
  for (const broken of brokenCandidates) {
    const seat = seats.find(s => s.row === broken.row && s.number === broken.number);
    if (seat) {
      seat.type = 'broken';
      seat.status = 'broken';
    }
  }

  return seats;
}
