const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/auth');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const sendAuthResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  });
};

/**
 * POST /api/auth/register
 * Admin rule: email must end with @cinema.com to get admin role.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const normalEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalEmail });
    if (existing)
      return res.status(409).json({ error: 'An account with that email already exists.' });

    // Admin role: ONLY if email ends with @cinema.com
    let assignedRole = 'customer';
    if (role === 'admin') {
      if (!normalEmail.endsWith('@cinema.com')) {
        return res.status(400).json({
          error: 'Admin accounts require a @cinema.com email address.'
        });
      }
      assignedRole = 'admin';
    }

    const user = await User.create({ name, email: normalEmail, password, role: assignedRole });
    sendAuthResponse(user, 201, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Incorrect email or password.' });
    if (!user.isActive)
      return res.status(401).json({ error: 'Account is inactive.' });

    sendAuthResponse(user, 200, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', protect, (req, res) => res.json({ user: req.user }));

/**
 * GET /api/auth/users  — admin: all users with booking counts
 */
router.get('/users', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Admins only.' });

    const users = await User.find().select('-password').sort({ createdAt: -1 });

    // Attach booking counts
    const usersWithCounts = await Promise.all(users.map(async (u) => {
      const total     = await Booking.countDocuments({ userId: u._id });
      const confirmed = await Booking.countDocuments({ userId: u._id, status: 'confirmed' });
      const cancelled = await Booking.countDocuments({ userId: u._id, status: 'cancelled' });
      return { ...u.toObject(), bookingCounts: { total, confirmed, cancelled } };
    }));

    res.json({ users: usersWithCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/auth/users/:id/toggle  — admin: activate/deactivate a user
 */
router.put('/users/:id/toggle', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
