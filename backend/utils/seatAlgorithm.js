/**
 * ============================================================
 * CINEMA SEATING OPTIMISATION ALGORITHM
 * ============================================================
 *
 * OBJECTIVE: Allocate seats intelligently to:
 *   1. Prevent scattered/isolated single empty seats
 *   2. Keep groups together in the same row
 *   3. Prefer centre seats for groups, edges for solos
 *   4. Avoid broken/unavailable seats
 *   5. Maximise occupancy efficiency
 *
 * SCORING SYSTEM:
 *   +10 = group seated fully together
 *   +8  = centre seats (cols 10–18)
 *   +5  = no orphan gaps created
 *   -10 = creates isolated single-seat gap
 *   -5  = splits group across rows
 *   -3  = poor viewing area (row A, B or O)
 *   -7  = leaves orphan seats adjacent to walls/booked
 *
 * ROW QUALITY TIERS (for cinema seating):
 *   TIER 1 (Best):  Rows G, H, I, J  – perfect viewing distance
 *   TIER 2 (Good):  Rows E, F, K, L
 *   TIER 3 (OK):    Rows C, D, M, N
 *   TIER 4 (Poor):  Rows A, B, O
 * ============================================================
 */

const ROWS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'];

// VIP rows and columns (per assessment brief)
const VIP_ROWS = ['E','F','G','H'];
const VIP_COLS = [12, 13, 14, 15];

// Disability rows (front two rows only)
const DISABILITY_ROWS = ['A', 'B'];

// Row viewing quality tier (lower = better, 1 is best)
const ROW_TIER = {
  A: 4, B: 4, C: 3, D: 3, E: 2, F: 2,
  G: 1, H: 1, I: 1, J: 1, K: 2, L: 2,
  M: 3, N: 3, O: 4
};

// Centre columns (highest quality)
const CENTRE_START = 10;
const CENTRE_END = 18;
const TOTAL_COLS = 28;

/**
 * Determine if a seat position is VIP
 */
function isVipSeat(row, col) {
  return VIP_ROWS.includes(row) && VIP_COLS.includes(col);
}

/**
 * Get all available seats from the current layout,
 * returning them as a structured map: { rowKey: [seatObjects] }
 */
function buildLayoutMap(seats) {
  const map = {};
  for (const seat of seats) {
    if (!map[seat.row]) map[seat.row] = {};
    map[seat.row][seat.number] = seat;
  }
  return map;
}

/**
 * Count consecutive available seats starting at column `startCol` in a row.
 * Returns the length of the contiguous block.
 */
function getConsecutiveBlock(rowSeats, startCol) {
  let count = 0;
  let col = startCol;
  while (rowSeats[col] && rowSeats[col].status === 'available') {
    count++;
    col++;
  }
  return count;
}

/**
 * ORPHAN GAP DETECTION
 *
 * After hypothetically booking `cols` in a row, check if the remaining
 * available seats adjacent to the booking would form a gap of size 1
 * (orphan seat) — which is exactly what we want to prevent.
 *
 * @param {Object} rowSeats   - map of col -> seat object for one row
 * @param {number[]} bookedCols - columns being booked in this allocation
 * @returns {number} - number of orphan gaps that would be created
 */
function countOrphanGapsAfterBooking(rowSeats, bookedCols) {
  // Build a simulated row state after booking
  const simulated = {};
  for (const [col, seat] of Object.entries(rowSeats)) {
    simulated[parseInt(col)] = seat.status === 'available' ? 'available' : 'taken';
  }
  for (const col of bookedCols) {
    simulated[col] = 'taken';
  }

  let orphans = 0;
  const cols = Object.keys(simulated).map(Number).sort((a, b) => a - b);

  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (simulated[col] !== 'available') continue;

    const prevAvail = i > 0 && simulated[cols[i - 1]] === 'available';
    const nextAvail = i < cols.length - 1 && simulated[cols[i + 1]] === 'available';

    // A seat is "orphaned" if both its neighbours (if they exist) are taken
    const prevBlocked = i === 0 || simulated[cols[i - 1]] === 'taken';
    const nextBlocked = i === cols.length - 1 || simulated[cols[i + 1]] === 'taken';

    if (prevBlocked && nextBlocked) {
      orphans++;
    }
  }

  return orphans;
}

/**
 * SCORE a candidate seat block in a given row.
 *
 * @param {string} row        - row letter
 * @param {number[]} cols     - column numbers of the block
 * @param {Object} rowSeats   - full row seat map
 * @param {number} groupSize  - how many people need seats
 * @returns {number} score    - higher is better
 */
function scoreCandidate(row, cols, rowSeats, groupSize) {
  let score = 0;

  // ✅ Group fully together bonus
  if (cols.length === groupSize) score += 10;

  // ✅ Centre seat bonus (cols 10–18 are premium)
  const centreCount = cols.filter(c => c >= CENTRE_START && c <= CENTRE_END).length;
  score += (centreCount / cols.length) * 8;

  // ✅ Row quality bonus (tier 1 rows = +6, tier 4 = 0)
  const tier = ROW_TIER[row] || 4;
  score += (5 - tier) * 2; // tier1=+8, tier2=+6, tier3=+4, tier4=+2

  // ❌ Orphan gap penalty
  const orphans = countOrphanGapsAfterBooking(rowSeats, cols);
  score -= orphans * 10;

  // ❌ Poor viewing penalty (front/back rows)
  if (['A', 'B', 'O'].includes(row)) score -= 3;

  // ✅ Solo user edge preference
  if (groupSize === 1) {
    const isEdge = cols[0] <= 4 || cols[0] >= TOTAL_COLS - 3;
    if (isEdge) score += 5;
    // Penalty for solo in dead-centre (wastes prime centre seats)
    if (cols[0] >= 12 && cols[0] <= 16) score -= 4;
  }

  // ❌ VIP seat used by non-VIP request (conservative booking)
  const usesVip = cols.some(c => isVipSeat(row, c));
  if (usesVip && groupSize <= 2) score -= 2;

  return score;
}

/**
 * FIND CANDIDATE BLOCKS in a single row.
 *
 * Scans the row for contiguous available seat sequences of length >= groupSize.
 * Returns all valid starting positions along with their block sizes.
 *
 * @param {Object} rowSeats - col -> seat object
 * @param {number} groupSize
 * @returns {Array<{startCol, cols}>}
 */
function findCandidateBlocks(rowSeats, groupSize) {
  const candidates = [];
  const availCols = Object.keys(rowSeats)
    .map(Number)
    .filter(c => rowSeats[c].status === 'available')
    .sort((a, b) => a - b);

  // Find contiguous runs
  let runStart = 0;
  for (let i = 0; i <= availCols.length; i++) {
    const isGap = i === availCols.length || (i > 0 && availCols[i] !== availCols[i - 1] + 1);
    if (isGap) {
      const run = availCols.slice(runStart, i);
      if (run.length >= groupSize) {
        // Every valid starting point in this run
        for (let j = 0; j <= run.length - groupSize; j++) {
          candidates.push({ cols: run.slice(j, j + groupSize) });
        }
      }
      runStart = i;
    }
  }

  return candidates;
}

/**
 * MAIN ALLOCATION FUNCTION
 *
 * Given the current seat layout and a group size, find the BEST
 * available block of seats using the scoring algorithm.
 *
 * @param {Array} seats       - all Seat documents from DB (or in-memory)
 * @param {number} groupSize  - number of seats needed (1–7)
 * @param {boolean} wantsVip  - whether the group wants VIP seats
 * @param {boolean} needsAccessible - whether accessibility required
 * @returns {{ seats, score, row, notes } | { error }}
 */
function allocateSeats(seats, groupSize, wantsVip = false, needsAccessible = false) {
  const layoutMap = buildLayoutMap(seats);

  // Filter rows based on request type
  let eligibleRows = [...ROWS];
  if (needsAccessible) {
    eligibleRows = DISABILITY_ROWS;
  } else if (wantsVip) {
    eligibleRows = VIP_ROWS;
  } else {
    // Regular: exclude disability rows from general allocation
    eligibleRows = ROWS.filter(r => !DISABILITY_ROWS.includes(r));
  }

  let bestScore = -Infinity;
  let bestCandidate = null;

  for (const row of eligibleRows) {
    const rowSeats = layoutMap[row] || {};

    // Filter to correct seat types
    const filteredRowSeats = {};
    for (const [col, seat] of Object.entries(rowSeats)) {
      if (seat.status === 'broken') continue;
      if (needsAccessible) {
        if (seat.type !== 'disability') continue;
      } else if (wantsVip) {
        if (seat.type !== 'vip') continue;
      } else {
        // Regular booking: exclude disability AND vip seats
        if (seat.type === 'disability') continue;
        if (seat.type === 'vip') continue;
      }
      filteredRowSeats[col] = seat;
    }

    const candidates = findCandidateBlocks(filteredRowSeats, groupSize);

    for (const candidate of candidates) {
      const score = scoreCandidate(row, candidate.cols, filteredRowSeats, groupSize);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = { row, cols: candidate.cols, score };
      }
    }
  }

  if (!bestCandidate) {
    return {
      error: 'NO_SEATS_AVAILABLE',
      message: `No block of ${groupSize} consecutive available seats exists anywhere in the cinema. ${seats.filter(s => s.status === 'available' && s.type !== 'broken').length} individual seats remain — try a smaller group size.`
    };
  }

  // Build result seat list
  const rowSeats = layoutMap[bestCandidate.row] || {};
  const allocatedSeats = bestCandidate.cols.map(col => rowSeats[col]);

  // Generate human-readable notes about the allocation
  const notes = generateAllocationNotes(bestCandidate.row, bestCandidate.cols, bestScore);

  return {
    seats: allocatedSeats,
    score: bestScore,
    row: bestCandidate.row,
    notes
  };
}

/**
 * Generate friendly notes explaining why this allocation was chosen.
 */
function generateAllocationNotes(row, cols, score) {
  const notes = [];
  const tier = ROW_TIER[row];
  const tierNames = { 1: 'optimal', 2: 'good', 3: 'acceptable', 4: 'front/back' };
  notes.push(`Row ${row} selected (${tierNames[tier] || 'standard'} viewing position)`);

  const centreCount = cols.filter(c => c >= CENTRE_START && c <= CENTRE_END).length;
  if (centreCount === cols.length) notes.push('Fully centred seats');
  else if (centreCount > 0) notes.push('Partially centred');

  if (score >= 15) notes.push('High quality allocation');
  else if (score >= 5) notes.push('Good allocation');
  else notes.push('Best available option');

  return notes.join(' · ');
}

/**
 * RECALCULATE QUALITY SCORES for all available seats.
 * Called after cancellations to re-evaluate the layout.
 *
 * @param {Array} seats - all seat documents
 * @returns {Array} seats with updated qualityScore
 */
function recalculateScores(seats) {
  const layoutMap = buildLayoutMap(seats);

  return seats.map(seat => {
    if (seat.status !== 'available') {
      return { ...seat, qualityScore: 0 };
    }

    const rowSeats = layoutMap[seat.row] || {};
    // A seat's quality is how many consecutive available neighbours it has
    let adjacentAvail = 0;
    if (rowSeats[seat.number - 1]?.status === 'available') adjacentAvail++;
    if (rowSeats[seat.number + 1]?.status === 'available') adjacentAvail++;

    const tier = ROW_TIER[seat.row] || 4;
    const centreBonus = (seat.number >= CENTRE_START && seat.number <= CENTRE_END) ? 3 : 0;
    const qualityScore = adjacentAvail * 4 + (5 - tier) + centreBonus;

    return { ...seat, qualityScore };
  });
}

/**
 * SIMULATION: Generate a realistic half-full or nearly-full layout.
 * Returns an array of { row, number } pairs to mark as booked.
 *
 * @param {Array} seats     - all available seats
 * @param {string} density  - 'half' | 'crowded' | 'nearly_full'
 * @returns {Array} seats to book
 */
function simulateOccupancy(seats, density) {
  const targets = { half: 0.5, crowded: 0.75, nearly_full: 0.9 };
  const targetRatio = targets[density] || 0.5;

  const available = seats.filter(s => s.status === 'available' && s.type !== 'broken');
  const toBook = Math.floor(available.length * targetRatio);

  // Shuffle and pick groups to simulate realistic booking patterns
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const booked = [];
  let i = 0;

  while (booked.length < toBook && i < shuffled.length) {
    // Randomly pick group sizes 1–5 to simulate real booking patterns
    const groupSize = Math.floor(Math.random() * 4) + 1;
    const group = shuffled.slice(i, i + groupSize).filter((_, idx) => {
      // Only take consecutive seats in same row
      if (idx === 0) return true;
      return shuffled[i + idx].row === shuffled[i].row &&
             shuffled[i + idx].number === shuffled[i + idx - 1].number + 1;
    });

    booked.push(...group.slice(0, Math.min(group.length, toBook - booked.length)));
    i += group.length || 1;
  }

  return booked;
}

/**
 * GENERATE BROKEN SEATS for a session.
 * Rules:
 * - 6–10 broken seats
 * - No two broken seats adjacent
 * - Not in disability zones (rows A/B)
 * - Not more than 2 broken per row
 *
 * @param {Array} seats - all seat documents
 * @returns {Array} seats to mark as broken
 */
function generateBrokenSeats(seats) {
  const eligible = seats.filter(s =>
    !DISABILITY_ROWS.includes(s.row) &&
    s.type !== 'disability' &&
    s.type !== 'vip'  // Prefer not breaking VIP seats
  );

  const brokenCount = Math.floor(Math.random() * 5) + 6; // 6–10
  const broken = [];
  const brokenByRow = {};
  const brokenSet = new Set();

  const shuffled = [...eligible].sort(() => Math.random() - 0.5);

  for (const seat of shuffled) {
    if (broken.length >= brokenCount) break;

    const rowKey = seat.row;
    const seatKey = `${seat.row}-${seat.number}`;

    // Max 2 broken per row
    if ((brokenByRow[rowKey] || 0) >= 2) continue;

    // No adjacent broken seats
    const leftKey = `${seat.row}-${seat.number - 1}`;
    const rightKey = `${seat.row}-${seat.number + 1}`;
    if (brokenSet.has(leftKey) || brokenSet.has(rightKey)) continue;

    broken.push(seat);
    brokenSet.add(seatKey);
    brokenByRow[rowKey] = (brokenByRow[rowKey] || 0) + 1;
  }

  return broken;
}

/**
 * FRAGMENTATION SCORE
 * Measures how fragmented the available seating is.
 * Lower = better (seats are clumped together).
 * Higher = worse (many isolated single gaps).
 *
 * @param {Array} seats
 * @returns {{ fragmentationScore, isolatedCount, occupancyPct }}
 */
function calculateFragmentation(seats) {
  const layoutMap = buildLayoutMap(seats);
  let isolatedCount = 0;
  let totalAvailable = 0;

  for (const row of ROWS) {
    const rowSeats = layoutMap[row] || {};
    const cols = Object.keys(rowSeats).map(Number).sort((a, b) => a - b);

    for (let i = 0; i < cols.length; i++) {
      const seat = rowSeats[cols[i]];
      if (seat.status !== 'available') continue;
      totalAvailable++;

      const prevTaken = i === 0 || rowSeats[cols[i - 1]]?.status !== 'available';
      const nextTaken = i === cols.length - 1 || rowSeats[cols[i + 1]]?.status !== 'available';

      if (prevTaken && nextTaken) isolatedCount++;
    }
  }

  const totalSeats = seats.length;
  const bookedSeats = seats.filter(s => s.status === 'booked').length;
  const occupancyPct = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;
  const fragmentationScore = totalAvailable > 0
    ? Math.round((isolatedCount / totalAvailable) * 100)
    : 0;

  return { fragmentationScore, isolatedCount, occupancyPct, totalAvailable, bookedSeats };
}

module.exports = {
  allocateSeats,
  recalculateScores,
  generateBrokenSeats,
  simulateOccupancy,
  calculateFragmentation,
  isVipSeat,
  ROWS,
  VIP_ROWS,
  VIP_COLS,
  DISABILITY_ROWS,
  ROW_TIER
};

/**
 * DETAILED REJECTION ANALYSIS
 *
 * When a booking cannot be completed without creating orphan gaps,
 * this function explains exactly why and suggests alternatives.
 *
 * @param {Array}  seats      - full seat layout
 * @param {number} groupSize  - requested group size
 * @param {boolean} wantsVip
 * @param {boolean} needsAccessible
 * @returns {{ reason, orphansWouldCreate, alternatives }}
 */
function analyseRejection(seats, groupSize, wantsVip = false, needsAccessible = false) {
  const layoutMap = buildLayoutMap(seats);
  let eligibleRows = needsAccessible ? DISABILITY_ROWS
    : wantsVip ? VIP_ROWS
    : ROWS.filter(r => !DISABILITY_ROWS.includes(r));

  const allCandidates = [];

  for (const row of eligibleRows) {
    const rowSeats = layoutMap[row] || {};
    const filteredRowSeats = {};
    for (const [col, seat] of Object.entries(rowSeats)) {
      if (seat.status === 'broken') continue;
      if (needsAccessible && seat.type !== 'disability') continue;
      if (!needsAccessible && seat.type === 'disability') continue;
      if (wantsVip && seat.type !== 'vip') continue;
      filteredRowSeats[col] = seat;
    }

    const candidates = findCandidateBlocks(filteredRowSeats, groupSize);
    for (const c of candidates) {
      const orphans = countOrphanGapsAfterBooking(filteredRowSeats, c.cols);
      const score = scoreCandidate(row, c.cols, filteredRowSeats, groupSize);
      allCandidates.push({ row, cols: c.cols, orphans, score });
    }
  }

  if (allCandidates.length === 0) {
    // No block of that size exists at all
    const totalAvail = seats.filter(s => s.status === 'available' && s.type !== 'broken').length;
    return {
      reason: `No block of ${groupSize} consecutive available seats exists anywhere in the cinema.`,
      detail: `Only ${totalAvail} seats are available, but none form a consecutive group of ${groupSize}.`,
      alternatives: getSmallerGroupAlternatives(seats, groupSize, wantsVip, needsAccessible),
      orphansWouldCreate: 0
    };
  }

  // Candidates exist but all create orphan gaps
  const minOrphans = Math.min(...allCandidates.map(c => c.orphans));
  const worstCase = allCandidates.find(c => c.orphans === minOrphans);

  const orphanPositions = worstCase ? getOrphanPositions(
    buildLayoutMap(seats)[worstCase.row] || {},
    worstCase.cols
  ) : [];

  return {
    reason: `All possible allocations of ${groupSize} seats would create isolated gap(s).`,
    detail: orphanPositions.length > 0
      ? `For example, booking Row ${worstCase.row} seats ${worstCase.cols.join(',')} would orphan seat(s): ${orphanPositions.map(p => `${worstCase.row}${p}`).join(', ')}.`
      : 'Every available block is surrounded by booked seats, leaving orphaned gaps.',
    alternatives: getSmallerGroupAlternatives(seats, groupSize, wantsVip, needsAccessible),
    orphansWouldCreate: minOrphans
  };
}

/** Get the column numbers of seats that would be orphaned after booking */
function getOrphanPositions(rowSeats, bookedCols) {
  const simulated = {};
  for (const [col, seat] of Object.entries(rowSeats)) {
    simulated[parseInt(col)] = seat.status === 'available' ? 'available' : 'taken';
  }
  for (const col of bookedCols) simulated[col] = 'taken';

  const cols = Object.keys(simulated).map(Number).sort((a, b) => a - b);
  const orphans = [];
  for (let i = 0; i < cols.length; i++) {
    if (simulated[cols[i]] !== 'available') continue;
    const prevBlocked = i === 0 || simulated[cols[i - 1]] === 'taken';
    const nextBlocked = i === cols.length - 1 || simulated[cols[i + 1]] === 'taken';
    if (prevBlocked && nextBlocked) orphans.push(cols[i]);
  }
  return orphans;
}

/** Suggest alternative group sizes that CAN be booked without orphan issues */
function getSmallerGroupAlternatives(seats, groupSize, wantsVip, needsAccessible) {
  const alternatives = [];
  for (let size = groupSize - 1; size >= 1; size--) {
    const result = allocateSeats(seats, size, wantsVip, needsAccessible);
    if (!result.error) {
      alternatives.push({
        groupSize: size,
        row: result.row,
        seats: result.seats.map(s => `${s.row}${s.number}`),
        score: result.score
      });
      if (alternatives.length >= 2) break;
    }
  }
  return alternatives;
}

module.exports.analyseRejection = analyseRejection;
