const express = require('express');
const router  = express.Router();
const Seat    = require('../models/Seat');
const { buildCinemaLayout } = require('../utils/layoutBuilder');
const { calculateFragmentation } = require('../utils/seatAlgorithm');

/**
 * Safely insert seats — if duplicate key error (stale indexes), drop+recreate and retry.
 */
async function safeInsertSeats(layout) {
  try {
    return await Seat.insertMany(layout, { ordered: false });
  } catch (err) {
    if (err.code === 11000 || (err.writeErrors && err.writeErrors.length > 0)) {
      // Duplicate key — return what was inserted (partial), or re-fetch
      const sessionId = layout[0]?.sessionId || 'default';
      const existing  = await Seat.find({ sessionId });
      if (existing.length > 0) return existing;
      // Try dropping stale indexes and re-inserting
      try {
        const col = Seat.collection;
        const indexes = await col.indexes();
        for (const idx of indexes) {
          if (idx.name !== '_id_') await col.dropIndex(idx.name).catch(() => {});
        }
        await col.createIndex(
          { row: 1, number: 1, sessionId: 1 },
          { unique: true, name: 'row_number_sessionId_unique' }
        );
      } catch (idxErr) {
        console.warn('Index fix attempt:', idxErr.message);
      }
      return await Seat.insertMany(layout, { ordered: false }).catch(async () => {
        return Seat.find({ sessionId: layout[0]?.sessionId || 'default' });
      });
    }
    throw err;
  }
}

/**
 * GET /api/seats
 */
router.get('/', async (req, res) => {
  try {
    const sessionId = req.query.sessionId || 'default';
    let seats = await Seat.find({ sessionId }).sort({ row: 1, number: 1 });

    if (seats.length === 0) {
      const layout = buildCinemaLayout(sessionId);
      seats = await safeInsertSeats(layout);
    }

    // Auto-reset if > 95% booked (stale simulation data)
    if (sessionId === 'default') {
      const booked = seats.filter(s => s.status === 'booked').length;
      if (seats.length > 0 && (booked / seats.length > 0.95 || seats.length < 100)) {
        await Seat.deleteMany({ sessionId });
        const layout = buildCinemaLayout(sessionId);
        seats = await safeInsertSeats(layout);
      }
    }

    const stats = calculateFragmentation(seats);
    res.json({ seats, stats, sessionId });
  } catch (err) {
    console.error('GET /seats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/seats/reset
 */
router.post('/reset', async (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    await Seat.deleteMany({ sessionId });
    const layout = buildCinemaLayout(sessionId);
    const seats  = await safeInsertSeats(layout);
    const stats  = calculateFragmentation(seats);
    res.json({ message: 'Layout reset', seats, stats });
  } catch (err) {
    console.error('POST /seats/reset error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
