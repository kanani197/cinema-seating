const mongoose = require('mongoose');

/**
 * IMPORTANT: Mongoose reserves `type` as a schema keyword.
 * Writing [{ row: String, number: Number, type: String }] makes Mongoose
 * treat the whole subdocument as type String — causing CastError.
 * Fix: wrap each field explicitly with { type: ... } syntax,
 * and use a named sub-schema with _id: false to avoid the conflict.
 */
const SeatRefSchema = new mongoose.Schema({
  row:      { type: String },
  number:   { type: Number },
  seatType: { type: String, default: 'regular' }  // renamed from 'type' to avoid Mongoose conflict
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  bookingRef:      { type: String, required: true, unique: true },
  customerName:    { type: String, required: true, trim: true },
  customerEmail:   { type: String, required: true, trim: true, lowercase: true },
  groupSize:       { type: Number, required: true, min: 1, max: 7 },
  seats:           [SeatRefSchema],
  sessionId:       { type: String, required: true, default: 'default' },
  status:          { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  allocationScore: { type: Number, default: 0 },
  allocationNotes: { type: String, default: '' },
  isAdminOverride: { type: Boolean, default: false },
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestId:         { type: String, default: null },
  userType:        { type: String, enum: ['customer', 'guest', 'admin'], default: 'customer' }
}, { timestamps: true });

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ guestId: 1, createdAt: -1 });
bookingSchema.index({ sessionId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
