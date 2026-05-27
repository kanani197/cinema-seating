/**
 * Cinema Layout Builder
 *
 * Constructs the exact cinema seating layout from the assessment brief:
 * - Rows A–O, Columns 1–28 (not all rows have all seats — the brief shows
 *   side columns 1–4 and 25–28 on some rows only)
 * - VIP: Rows E–H, Columns 12–15
 * - Disability: 6 adjacent seats in rows A or B
 * - Broken: Generated per-session by the algorithm
 */

const { VIP_ROWS, VIP_COLS, DISABILITY_ROWS, generateBrokenSeats } = require('./seatAlgorithm');

const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];

/**
 * Get the seat columns available for each row.
 * Based on the visual layout in the assessment PDF which shows:
 * - Rows A–D: cols 1–4, 5–24, 25–28
 * - Rows E–H: cols 1–4, 5–24, 25–28 (fewer side seats in some rows)
 * - Rows I–O: progressively fewer side seats
 *
 * For simplicity and accuracy we use a consistent 28-column layout
 * with the exact side-seat presence from the visual.
 */
function getRowColumns(row) {
  // All rows have the main body: cols 5–24
  // Side seats (1–4 and 25–28) vary per row based on the visual
  const mainBody = Array.from({ length: 20 }, (_, i) => i + 5); // 5–24

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

/**
 * Determine seat type for a given row/column combination.
 */
function getSeatType(row, col, disabilitySeats) {
  // Check if it's a disability seat (pre-assigned)
  if (disabilitySeats.some(d => d.row === row && d.col === col)) {
    return 'disability';
  }
  // VIP zone: rows E–H, columns 12–15
  if (VIP_ROWS.includes(row) && VIP_COLS.includes(col)) {
    return 'vip';
  }
  return 'regular';
}

/**
 * Generate the 6 disability seats.
 * Rules: front two rows only (A or B), must be adjacent (consecutive).
 */
function generateDisabilitySeats() {
  // Place 6 adjacent disability seats in row A, starting from col 5
  // (first available main body position)
  const row = 'A';
  const startCol = 5;
  return Array.from({ length: 6 }, (_, i) => ({ row, col: startCol + i }));
}

/**
 * Build the full cinema layout as an array of plain seat objects.
 * This is used to initialise the database or for in-memory operations.
 *
 * @param {string} sessionId
 * @returns {Array} seat objects ready for DB insertion or in-memory use
 */
function buildCinemaLayout(sessionId = 'default') {
  const disabilitySeats = generateDisabilitySeats();
  const seats = [];

  for (const row of ROWS) {
    const cols = getRowColumns(row);
    for (const col of cols) {
      const type = getSeatType(row, col, disabilitySeats);
      seats.push({
        row,
        number: col,
        type,
        status: type === 'broken' ? 'broken' : 'available',
        sessionId,
        bookingId: null,
        qualityScore: 0
      });
    }
  }

  // Generate and mark broken seats
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

/**
 * Build an in-memory layout (no DB) for the frontend-only demo mode.
 */
function buildInMemoryLayout(sessionId = 'default') {
  return buildCinemaLayout(sessionId).map((seat, index) => ({
    ...seat,
    _id: `seat_${seat.row}_${seat.number}`,
    id: `seat_${seat.row}_${seat.number}`
  }));
}

module.exports = { buildCinemaLayout, buildInMemoryLayout, getRowColumns, ROWS };
