const express = require('express');
const router = express.Router();
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { buildCinemaLayout } = require('../utils/layoutBuilder');
const { calculateFragmentation, generateBrokenSeats } = require('../utils/seatAlgorithm');
const { protect } = require('../middleware/auth');

// Admin gate: JWT admin role OR secret header (for offline/demo mode)
const adminGate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return protect(req, res, async () => {
      if (req.user?.role === 'admin') return next();
      return res.status(403).json({ error: 'Admin access required.' });
    });
  }
  const secret = req.headers['x-admin-secret'] || req.body?.adminSecret;
  if (secret === process.env.ADMIN_SECRET) return next();
  return res.status(401).json({ error: 'Admin authentication required.' });
};

/** GET /api/admin/stats — full dashboard analytics */
router.get('/stats', adminGate, async (req, res) => {
  try {
    const { sessionId = 'default' } = req.query;
    const seats    = await Seat.find({ sessionId });
    const stats    = calculateFragmentation(seats);
    const allBookings = await Booking.find({ sessionId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    const confirmed  = allBookings.filter(b => b.status === 'confirmed');
    const cancelled  = allBookings.filter(b => b.status === 'cancelled');
    const guestBookings = allBookings.filter(b => b.userType === 'guest');
    const userBookings  = allBookings.filter(b => b.userType !== 'guest');

    // Guest booking count (distinct guestIds)
    const uniqueGuests = new Set(allBookings.filter(b => b.guestId).map(b => b.guestId)).size;

    // Per-user booking counts
    const userCounts = {};
    allBookings.forEach(b => {
      if (b.userId) {
        const key = b.userId._id?.toString() || b.userId.toString();
        if (!userCounts[key]) userCounts[key] = { user: b.userId, confirmed: 0, cancelled: 0 };
        if (b.status === 'confirmed') userCounts[key].confirmed++;
        else userCounts[key].cancelled++;
      }
    });

    res.json({
      stats,
      seats: {
        total:      seats.length,
        available:  seats.filter(s => s.status === 'available').length,
        booked:     seats.filter(s => s.status === 'booked').length,
        broken:     seats.filter(s => s.type   === 'broken').length,
        vipBooked:  seats.filter(s => s.type   === 'vip' && s.status === 'booked').length,
        disBooked:  seats.filter(s => s.type   === 'disability' && s.status === 'booked').length,
      },
      bookings: {
        total:     allBookings.length,
        confirmed: confirmed.length,
        cancelled: cancelled.length,
        guests:    guestBookings.length,
        users:     userBookings.length,
        uniqueGuests,
      },
      recentBookings: allBookings.slice(0, 15),
      userCounts: Object.values(userCounts),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/override — force-allocate seats */
router.post('/override', adminGate, async (req, res) => {
  try {
    const { customerName, customerEmail, seats: requestedSeats, sessionId = 'default' } = req.body;
    if (!requestedSeats?.length) return res.status(400).json({ error: 'Seats array required.' });

    const seatDocs = await Seat.find({
      sessionId,
      $or: requestedSeats.map(s => ({ row: s.row, number: parseInt(s.number) }))
    });

    const bookingRef = `ADMIN-${Date.now()}`;
    const booking = new Booking({
      bookingRef,
      customerName: customerName || 'Admin Override',
      customerEmail: customerEmail || 'admin@cinema.com',
      groupSize: seatDocs.length,
      seats: seatDocs.map(s => ({ row: s.row, number: s.number, seatType: s.type || "regular" })),
      sessionId, isAdminOverride: true, userType: 'admin',
      allocationNotes: 'Admin override — seating rules bypassed'
    });
    await booking.save();
    await Promise.all(seatDocs.map(s =>
      Seat.findByIdAndUpdate(s._id, { status: 'booked', bookingId: booking._id })
    ));
    res.json({ message: 'Override booking created.', booking });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /api/admin/mark-broken */
router.post('/mark-broken', adminGate, async (req, res) => {
  try {
    const { row, number, sessionId = 'default' } = req.body;
    const seat = await Seat.findOneAndUpdate(
      { row, number: parseInt(number), sessionId },
      { $set: { status: 'broken', type: 'broken', bookingId: null } },
      { new: true }
    );
    if (!seat) return res.status(404).json({ error: 'Seat not found.' });
    res.json({ seat });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /api/admin/restore-seat */
router.post('/restore-seat', adminGate, async (req, res) => {
  try {
    const { row, number, sessionId = 'default' } = req.body;
    const seat = await Seat.findOneAndUpdate(
      { row, number: parseInt(number), sessionId },
      { $set: { status: 'available', type: 'regular', bookingId: null } },
      { new: true }
    );
    if (!seat) return res.status(404).json({ error: 'Seat not found.' });
    res.json({ seat });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /api/admin/generate-broken */
router.post('/generate-broken', adminGate, async (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    await Seat.updateMany({ sessionId, type: 'broken' }, { $set: { status: 'available', type: 'regular' } });
    const seats = await Seat.find({ sessionId });
    const toBreak = generateBrokenSeats(seats);
    await Promise.all(toBreak.map(s =>
      Seat.findByIdAndUpdate(s._id, { status: 'broken', type: 'broken' })
    ));
    const updated = await Seat.find({ sessionId });
    res.json({ brokenCount: toBreak.length, stats: calculateFragmentation(updated) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /api/admin/cancel-booking */
router.post('/cancel-booking', adminGate, async (req, res) => {
  try {
    const { bookingRef, sessionId = 'default' } = req.body;
    const booking = await Booking.findOne({ bookingRef });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    await Seat.updateMany({ bookingId: booking._id }, { $set: { status: 'available', bookingId: null } });
    booking.status = 'cancelled';
    await booking.save();
    const updated = await Seat.find({ sessionId });
    res.json({ message: 'Booking cancelled.', booking, stats: calculateFragmentation(updated) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/** POST /api/admin/reset */
router.post('/reset', adminGate, async (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    await Seat.deleteMany({ sessionId });
    await Booking.deleteMany({ sessionId });
    const layout = buildCinemaLayout(sessionId);
    const seats = await Seat.insertMany(layout);
    res.json({ message: 'Cinema reset.', stats: calculateFragmentation(seats) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
