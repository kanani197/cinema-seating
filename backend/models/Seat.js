const mongoose = require('mongoose');

/**
 * Seat Schema
 * Represents a single cinema seat with all its properties.
 *
 * Cinema Layout (based on assessment brief):
 * - Rows A–O (15 rows)
 * - Columns 1–28 (28 seats per row, but NOT all rows have all seats)
 * - VIP: Rows E–H, Columns 12–15
 * - Disability: 6 seats in rows A or B, adjacent
 * - Broken: 6–10 per session, not adjacent, not in disability zone
 */
const seatSchema = new mongoose.Schema({
  row: {
    type: String,
    required: true,
    enum: ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O']
  },
  number: {
    type: Number,
    required: true,
    min: 1,
    max: 28
  },
  type: {
    type: String,
    enum: ['regular', 'vip', 'disability', 'broken'],
    default: 'regular'
  },
  status: {
    type: String,
    enum: ['available', 'booked', 'broken', 'reserved'],
    default: 'available'
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  sessionId: {
    type: String,
    required: true,
    default: 'default'
  },
  qualityScore: {
    type: Number,
    default: 0
  }
}, { timestamps: true });
seatSchema.index({ row: 1, number: 1, sessionId: 1 }, { unique: true, name: 'row_number_sessionId_unique' });

module.exports = mongoose.model('Seat', seatSchema);
