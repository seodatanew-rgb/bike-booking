const User    = require('../models/user.model');
const Booking = require('../models/booking.model');

// GET /api/users  [admin]
exports.getUsers = async (req, res, next) => {
  try {
    const { role, is_active, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (role)      filter.role      = role;
    if (is_active !== undefined) filter.is_active = is_active === 'true';

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page:  Number(page),
      pages: Math.ceil(total / Number(limit)),
      data:  users,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id  [admin]
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Attach recent booking history
    const bookings = await Booking.find({ user_id: user._id })
      .populate('bike_id', 'name brand type')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, data: { ...user.toJSON(), recent_bookings: bookings } });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id/role  [admin]
exports.changeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be admin or staff.' });
    }

    // Prevent admin from demoting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, data: user, message: `Role updated to ${role}.` });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/:id/toggle  [admin]
exports.toggleUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.is_active = !user.is_active;
    await user.save();

    res.json({
      success: true,
      data:    user,
      message: `User ${user.is_active ? 'activated' : 'deactivated'} successfully.`,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id  [admin]
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
};
