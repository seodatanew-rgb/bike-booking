const jwt  = require('jsonwebtoken');
const User = require('../models/user.model');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const user  = await User.create({ name, email, password, role, phone });
    const token = signToken(user._id);

    res.status(201).json({ success: true, token, data: user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account deactivated. Contact admin.' });
    }

    const token = signToken(user._id);
    user.password = undefined;

    res.json({ success: true, token, data: user });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

// PUT /api/auth/me
exports.updateMe = async (req, res, next) => {
  try {
    const { name, phone, current_password, new_password } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new one.' });
      }
      const match = await user.matchPassword(current_password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
      }
      user.password = new_password;
    }

    if (name)  user.name  = name;
    if (phone) user.phone = phone;

    await user.save();
    user.password = undefined;

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  // Stateless JWT: client deletes token. For token blacklisting, add Redis here.
  res.json({ success: true, message: 'Logged out successfully.' });
};
