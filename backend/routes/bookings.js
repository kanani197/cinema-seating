const express  = require('express');
const router   = express.Router();
const Seat     = require('../models/Seat');
const Booking  = require('../models/Booking');
const { allocateSeats, calculateFragmentation, analyseRejection } = require('../utils/seatAlgorithm');
const { buildCinemaLayout } = require('../utils/layoutBuilder');
const { optionalAuth, protect } = require('../middleware/auth');

/**
 * Get seats for a session, auto-resetting if the layout is stale/full.
 * Resets when:
 *  - No seats exist
 *  - Fewer than 100 seats (corrupt)
 *  - Fewer than `minAvailable` available seats remain (auto-recover)
 */
async function getOrInitSeats(sessionId, minAvailable = 10) {
  let seats = await Seat.find({ sessionId });

  const available = seats.filter(s => s.status === 'available' && s.type !== 'broken').length;

  const needsReset =
    seats.length === 0 ||
    seats.length < 100 ||
    available < minAvailable;

  if (needsReset) {
    await Seat.deleteMany({ sessionId });
    const layout = buildCinemaLayout(sessionId);
    try {
      seats = await Seat.insertMany(layout, { ordered: false });
    } catch (err) {
      if (err.code === 11000) {
        // Stale index — drop all non-_id indexes and recreate
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
          seats = await Seat.insertMany(layout, { ordered: false });
        } catch (retryErr) {
          seats = await Seat.find({ sessionId });
          if (!seats.length) throw retryErr;
        }
      } else {
        throw err;
      }
    }
  }

  return seats;
}

/**
 * POST /api/bookings/book
 * Books seats using the optimisation algorithm.
 * NEVER returns a 409 rejection for a fixable stale-DB issue.
 */
router.post('/book', optionalAuth, async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      groupSize,
      wantsVip        = false,
      needsAccessible = false,
      sessionId       = 'default',
      guestId         = null,
      userType        = 'customer',
    } = req.body;

    if (!customerName || !customerEmail)
      return res.status(400).json({ error: 'Name and email are required.' });

    const size = parseInt(groupSize);
    if (!size || size < 1 || size > 7)
      return res.status(400).json({ error: 'Group size must be between 1 and 7.' });

    // Get seats — auto-resets if fewer than `size+2` available
    const seats = await getOrInitSeats(sessionId, size + 2);

    // Run optimisation algorithm
    const result = allocateSeats(seats, size, wantsVip, needsAccessible);

    if (result.error) {
      // If algorithm still fails on a fresh layout, it genuinely can't be done
      // (e.g. groupSize=7 but only 6 seats in accessible zone)
      const analysis = analyseRejection(seats, size, wantsVip, needsAccessible);
      return res.status(409).json({
        error:     result.error,
        message:   result.message,
        rejection: analysis,
      });
    }

    const bookingRef = `CIN-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const booking = new Booking({
      bookingRef,
      customerName,
      customerEmail,
      groupSize:       size,
      seats:           result.seats.map(s => ({ row: s.row, number: s.number, seatType: s.type || s.seatType || "regular" })),
      sessionId,
      allocationScore: result.score,
      allocationNotes: result.notes,
      userId:    req.user ? req.user._id : null,
      guestId:   guestId  || null,
      userType:  req.user ? req.user.role : (guestId ? 'guest' : 'customer'),
    });

    await booking.save();

    // Update each seat individually (no transaction needed)
    await Promise.all(result.seats.map(s =>
      Seat.findByIdAndUpdate(s._id, { status: 'booked', bookingId: booking._id })
    ));

    const updatedSeats = await Seat.find({ sessionId });
    const stats = calculateFragmentation(updatedSeats);

    res.status(201).json({
      booking,
      allocatedSeats:  result.seats,
      allocationNotes: result.notes,
      allocationScore: result.score,
      stats,
    });

  } catch (err) {
    console.error('Book error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bookings/cancel
 */
router.post('/cancel', optionalAuth, async (req, res) => {
  try {
    const { bookingRef, sessionId = 'default' } = req.body;
    const booking = await Booking.findOne({ bookingRef });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled.' });

    if (req.user && req.user.role !== 'admin' && booking.userId) {
      if (booking.userId.toString() !== req.user._id.toString())
        return res.status(403).json({ error: 'You can only cancel your own bookings.' });
    }

    await Seat.updateMany(
      { bookingId: booking._id },
      { $set: { status: 'available', bookingId: null } }
    );
    booking.status = 'cancelled';
    await booking.save();

    const updatedSeats = await Seat.find({ sessionId });
    res.json({ message: 'Booking cancelled.', booking, stats: calculateFragmentation(updatedSeats) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/bookings */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { sessionId = 'default', guestId } = req.query;
    let query = { sessionId };
    if (req.user?.role === 'admin') { /* no filter */ }
    else if (req.user?.role === 'customer') { query.userId = req.user._id; }
    else if (guestId) { query.guestId = guestId; }

    const bookings = await Booking.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/bookings/my */
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/bookings/all — admin */
router.get('/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
    const bookings = await Booking.find()
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
