/**
 * Client-side Seating Optimisation Algorithm
 *
 * KEY DESIGN PRINCIPLE:
 * The algorithm PREFERS to avoid orphan gaps (via scoring) but NEVER
 * rejects a booking solely because it would create them — only rejects
 * when absolutely no consecutive block of the requested size exists.
 */
import { ROWS, VIP_ROWS, DISABILITY_ROWS } from './layoutBuilder';

const ROW_TIER = {
  A: 4, B: 4, C: 3, D: 3, E: 2, F: 2,
  G: 1, H: 1, I: 1, J: 1, K: 2, L: 2,
  M: 3, N: 3, O: 4
};
const CENTRE_START = 10;
const CENTRE_END   = 18;

function buildLayoutMap(seats) {
  const map = {};
  for (const seat of seats) {
    if (!map[seat.row]) map[seat.row] = {};
    map[seat.row][seat.number] = seat;
  }
  return map;
}

function countOrphanGapsAfterBooking(rowSeats, bookedCols) {
  const sim = {};
  for (const [col, seat] of Object.entries(rowSeats)) {
    sim[parseInt(col)] = seat.status === 'available' ? 'available' : 'taken';
  }
  for (const col of bookedCols) sim[col] = 'taken';

  let orphans = 0;
  const cols = Object.keys(sim).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < cols.length; i++) {
    if (sim[cols[i]] !== 'available') continue;
    const prevBlocked = i === 0          || sim[cols[i - 1]] === 'taken';
    const nextBlocked = i === cols.length - 1 || sim[cols[i + 1]] === 'taken';
    if (prevBlocked && nextBlocked) orphans++;
  }
  return orphans;
}

function scoreCandidate(row, cols, rowSeats, groupSize) {
  let score = 0;

  // Group bonus
  if (cols.length === groupSize) score += 10;

  // Centre bonus
  const centreCount = cols.filter(c => c >= CENTRE_START && c <= CENTRE_END).length;
  score += (centreCount / cols.length) * 8;

  // Row quality
  const tier = ROW_TIER[row] || 4;
  score += (5 - tier) * 2;

  // Orphan PENALTY (soft — does not cause rejection, just lowers score)
  const orphans = countOrphanGapsAfterBooking(rowSeats, cols);
  score -= orphans * 10;

  // Poor row penalty
  if (['A', 'B', 'O'].includes(row)) score -= 3;

  // Solo edge preference
  if (groupSize === 1) {
    if (cols[0] <= 4 || cols[0] >= 25) score += 5;
  }

  return score;
}

function findCandidateBlocks(rowSeats, groupSize) {
  const candidates = [];
  const availCols = Object.keys(rowSeats)
    .map(Number)
    .filter(c => rowSeats[c] && rowSeats[c].status === 'available')
    .sort((a, b) => a - b);

  let runStart = 0;
  for (let i = 0; i <= availCols.length; i++) {
    const isGap = i === availCols.length ||
      (i > 0 && availCols[i] !== availCols[i - 1] + 1);
    if (isGap) {
      const run = availCols.slice(runStart, i);
      if (run.length >= groupSize) {
        for (let j = 0; j <= run.length - groupSize; j++) {
          candidates.push({ cols: run.slice(j, j + groupSize) });
        }
      }
      runStart = i;
    }
  }
  return candidates;
}

function generateNotes(row, cols, score) {
  const tier = ROW_TIER[row];
  const tiers = { 1: 'optimal viewing', 2: 'good viewing', 3: 'acceptable', 4: 'front/back' };
  const parts = [`Row ${row} (${tiers[tier] || 'standard'})`];
  const centreCount = cols.filter(c => c >= CENTRE_START && c <= CENTRE_END).length;
  if (centreCount === cols.length) parts.push('fully centred');
  else if (centreCount > 0) parts.push('partially centred');
  if (score >= 15) parts.push('high quality');
  else if (score >= 0) parts.push('good allocation');
  else parts.push('best available — some fragmentation unavoidable');
  return parts.join(' · ');
}

export function allocateSeatsClient(seats, groupSize, wantsVip = false, needsAccessible = false) {
  if (!seats || seats.length === 0) {
    return { error: 'NO_SEATS_AVAILABLE', message: 'No seats loaded. Please refresh the page.' };
  }

  const size = parseInt(groupSize) || 1;
  const layoutMap = buildLayoutMap(seats);

  let eligibleRows;
  if (needsAccessible) {
    eligibleRows = DISABILITY_ROWS;
  } else if (wantsVip) {
    eligibleRows = VIP_ROWS;
  } else {
    eligibleRows = ROWS.filter(r => !DISABILITY_ROWS.includes(r));
  }

  let bestScore     = -Infinity;
  let bestCandidate = null;

  for (const row of eligibleRows) {
    const rowSeats = layoutMap[row] || {};

    // Build filtered seat map for this row
    const filteredRowSeats = {};
    for (const [col, seat] of Object.entries(rowSeats)) {
      if (seat.status === 'broken') continue;
      if (needsAccessible) {
        if (seat.type !== 'disability') continue;
      } else if (wantsVip) {
        if (seat.type !== 'vip') continue;
      } else {
        // Regular: exclude disability AND vip seats
        if (seat.type === 'disability') continue;
        if (seat.type === 'vip') continue;
      }
      filteredRowSeats[col] = seat;
    }

    const candidates = findCandidateBlocks(filteredRowSeats, size);
    for (const candidate of candidates) {
      const score = scoreCandidate(row, candidate.cols, filteredRowSeats, size);
      if (score > bestScore) {
        bestScore     = score;
        bestCandidate = { row, cols: candidate.cols, score };
      }
    }
  }

  // Only reject when NO block of the requested size exists anywhere
  if (!bestCandidate) {
    const totalAvail = seats.filter(s => s.status === 'available' && s.type !== 'broken').length;
    return {
      error:   'NO_SEATS_AVAILABLE',
      message: totalAvail === 0
        ? 'The cinema is fully booked.'
        : `No ${size} consecutive available seat${size > 1 ? 's' : ''} found. ${totalAvail} individual seats remain — try a smaller group.`
    };
  }

  // Retrieve the actual seat objects
  const rowSeats       = layoutMap[bestCandidate.row] || {};
  const allocatedSeats = bestCandidate.cols.map(col => rowSeats[col]).filter(Boolean);

  if (allocatedSeats.length !== size) {
    return { error: 'NO_SEATS_AVAILABLE', message: 'Seat lookup error — please reset the layout.' };
  }

  return {
    seats: allocatedSeats,
    score: bestScore,
    row:   bestCandidate.row,
    notes: generateNotes(bestCandidate.row, bestCandidate.cols, bestScore),
  };
}

export function calculateFragmentationClient(seats) {
  const layoutMap   = buildLayoutMap(seats);
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

  const totalSeats  = seats.length;
  const bookedSeats = seats.filter(s => s.status === 'booked').length;
  const occupancyPct = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;
  const fragmentationScore = totalAvailable > 0
    ? Math.round((isolatedCount / totalAvailable) * 100) : 0;

  return { fragmentationScore, isolatedCount, occupancyPct, totalAvailable, bookedSeats };
}

export function simulateOccupancyClient(seats, density) {
  const targets    = { half: 0.5, crowded: 0.75, nearly_full: 0.9 };
  const ratio      = targets[density] || 0.5;
  const available  = seats.filter(s => s.status === 'available' && s.type !== 'broken');
  const toBook     = Math.floor(available.length * ratio);

  let updatedSeats      = [...seats];
  let booked            = 0;
  let groupsKeptTogether = 0;
  let orphansPrevented  = 0;

  while (booked < toBook) {
    const groupSize = Math.floor(Math.random() * 4) + 1;
    const result    = allocateSeatsClient(updatedSeats, Math.min(groupSize, toBook - booked));
    if (result.error) break;

    updatedSeats = updatedSeats.map(seat => {
      const hit = result.seats.find(r => r.row === seat.row && r.number === seat.number);
      return hit ? { ...seat, status: 'booked' } : seat;
    });

    booked += result.seats.length;
    if (result.seats.length > 1) groupsKeptTogether++;
    if (result.score >= 0) orphansPrevented++;
  }

  return {
    seats: updatedSeats,
    stats: calculateFragmentationClient(updatedSeats),
    bookingsCreated:    booked,
    groupsKeptTogether,
    orphansPrevented,
  };
}
