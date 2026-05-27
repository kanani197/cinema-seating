require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');

const seatRoutes       = require('./routes/seats');
const bookingRoutes    = require('./routes/bookings');
const adminRoutes      = require('./routes/admin');
const simulationRoutes = require('./routes/simulation');
const authRoutes       = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth',     authRoutes);
app.use('/api/seats',    seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/simulate', simulationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

async function fixIndexes() {
  try {
    const db = mongoose.connection.db;

    const seatsCol = db.collection('seats');
    const seatIndexes = await seatsCol.indexes();
    for (const idx of seatIndexes) {
      if (idx.name === '_id_') continue; // never drop _id
      const fields = Object.keys(idx.key || {});
      const hasOldField = fields.includes('seatNumber');
      const hasMissingField = fields.some(f => !['row','number','sessionId','_id'].includes(f) && f !== '__v');
      if (hasOldField || hasMissingField) {
        console.log(`🔧 Dropping stale index "${idx.name}" from seats`);
        await seatsCol.dropIndex(idx.name).catch(() => {});
      }
    }

    // Ensure the correct index exists
    await seatsCol.createIndex(
      { row: 1, number: 1, sessionId: 1 },
      { unique: true, name: 'row_number_sessionId_unique' }
    );
    console.log('✅ Seat indexes verified');
    const bookingsCol = db.collection('bookings');
    const bookingIndexes = await bookingsCol.indexes();
    for (const idx of bookingIndexes) {
      if (idx.name === '_id_') continue;
      const validNames = ['bookingRef_unique', 'userId_createdAt', 'guestId_createdAt', 'sessionId_status'];
      if (!validNames.includes(idx.name) && idx.name !== '_id_') {
        console.log(`🔧 Dropping stale booking index "${idx.name}"`);
        await bookingsCol.dropIndex(idx.name).catch(() => {});
      }
    }

  } catch (err) {
    console.warn('⚠️  Index fix warning:', err.message);
  }
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
    await fixIndexes();
  } catch (err) {
    console.error('⚠️  MongoDB connection error:', err.message);
    console.log('   Running in offline/demo mode.');
  }
};

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  connectDB();
  app.listen(PORT, () => {
    console.log(`🎬 Cinema Seating API running on port ${PORT}`);
  });
}

module.exports = app;
