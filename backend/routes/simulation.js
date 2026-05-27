const express = require('express');
const router = express.Router();
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const { simulateOccupancy, calculateFragmentation, allocateSeats } = require('../utils/seatAlgorithm');
const { buildCinemaLayout } = require('../utils/layoutBuilder');

/**
 * POST /api/simulate
 * Run a stress test simulation on the cinema.
 */
router.post('/', async (req, res) => {
  try {
    const { density = 'half', sessionId = `sim_${Date.now()}` } = req.body;

    // Always start fresh for simulation
    await Seat.deleteMany({ sessionId });
    const layout = buildCinemaLayout(sessionId);
    let seats = await Seat.insertMany(layout);

    // Run simulation: book seats in waves
    const toBook = simulateOccupancy(seats, density);
    const bookingRefs = [];
    let orphansPrevented = 0;
    let groupsKeptTogether = 0;

    // Simulate bookings in random group sizes
    let i = 0;
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Evan', 'Fiona', 'George'];

    while (i < toBook.length) {
      const groupSize = Math.min(
        Math.floor(Math.random() * 4) + 1,
        toBook.length - i
      );

      const freshSeats = await Seat.find({ sessionId });
      const result = allocateSeats(freshSeats, groupSize, false, false);

      if (!result.error) {
        const bookingRef = `SIM-${Date.now()}-${i}`;
        const booking = new Booking({
          bookingRef,
          customerName: names[Math.floor(Math.random() * names.length)],
          customerEmail: 'sim@cinema.com',
          groupSize,
          seats: result.seats.map(s => ({ row: s.row, number: s.number, seatType: s.type || s.seatType || "regular" })),
          sessionId,
          allocationScore: result.score
        });
        await booking.save();

        await Seat.updateMany(
          { _id: { $in: result.seats.map(s => s._id) } },
          { $set: { status: 'booked', bookingId: booking._id } }
        );

        bookingRefs.push(bookingRef);
        if (groupSize > 1) groupsKeptTogether++;
        if (result.score >= 5) orphansPrevented++;
      }

      i += groupSize;
    }

    const finalSeats = await Seat.find({ sessionId });
    const stats = calculateFragmentation(finalSeats);

    res.json({
      message: `Simulation complete: ${density} density`,
      sessionId,
      stats,
      bookingsCreated: bookingRefs.length,
      groupsKeptTogether,
      orphansPrevented,
      seats: finalSeats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
