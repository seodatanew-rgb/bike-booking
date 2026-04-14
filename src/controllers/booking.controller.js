const Booking   = require('../models/booking.model');
const Bike      = require('../models/bike.model');
const PromoCode = require('../models/promo.model');

// Helper: check for conflicting bookings
const hasConflict = async (bikeId, startTime, endTime, excludeId = null) => {
  const query = {
    bike_id: bikeId,
    status:  { $in: ['pending', 'confirmed', 'active'] },
    $or: [{ start_time: { $lt: endTime }, end_time: { $gt: startTime } }],
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Booking.findOne(query);
};

// Helper: calculate booking amount
const GST_RATE = 0.18;

const calcAmount = (bike, durationHours) => {
  const days = Math.ceil(durationHours / 24) || 1;
  const base = days * bike.price_per_day;
  return Math.round(base * 100) / 100;
};

const addGST = (base) => {
  const gst = Math.round(base * GST_RATE * 100) / 100;
  return { gst, total: Math.round((base + gst) * 100) / 100 };
};

// POST /api/bookings
exports.createBooking = async (req, res, next) => {
  try {
    const { bike_id, start_time, end_time, promo_code, notes } = req.body;

    // 1. Check bike exists and is available
    const bike = await Bike.findOne({ _id: bike_id, is_active: true });
    if (!bike) return res.status(404).json({ success: false, message: 'Bike not found.' });
    if (bike.status !== 'available') {
      return res.status(409).json({ success: false, message: `Bike is currently ${bike.status}.` });
    }

    // 2. Check no schedule conflict
    const conflict = await hasConflict(bike_id, new Date(start_time), new Date(end_time));
    if (conflict) {
      return res.status(409).json({ success: false, message: 'Bike is already booked for this time slot.' });
    }

    // 3. Calculate amount
    const durationHours = (new Date(end_time) - new Date(start_time)) / (1000 * 60 * 60);
    const total_amount  = calcAmount(bike, durationHours);

    // 4. Apply promo code if provided
    let discount_amount = 0;
    let promo_id        = null;

    if (promo_code) {
      const promo = await PromoCode.findOne({ code: promo_code.toUpperCase(), is_active: true });

      if (!promo) {
        return res.status(400).json({ success: false, message: 'Invalid or inactive promo code.' });
      }
      if (promo.expires_at && promo.expires_at < new Date()) {
        return res.status(400).json({ success: false, message: 'Promo code has expired.' });
      }
      if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
        return res.status(400).json({ success: false, message: 'Promo code usage limit reached.' });
      }
      if (total_amount < promo.min_booking_amount) {
        return res.status(400).json({
          success: false,
          message: `Minimum booking amount of ${promo.min_booking_amount} required for this promo.`,
        });
      }

      discount_amount = promo.discount_type === 'percent'
        ? (total_amount * promo.discount_value) / 100
        : promo.discount_value;

      discount_amount = Math.min(discount_amount, total_amount);
      promo_id        = promo._id;

      // Increment usage count
      await PromoCode.findByIdAndUpdate(promo._id, { $inc: { used_count: 1 } });
    }

    const after_discount = Math.max(0, total_amount - discount_amount);
    const gst_amount    = Math.round(after_discount * GST_RATE * 100) / 100;
    const final_amount  = Math.round((after_discount + gst_amount) * 100) / 100;

    // 5. Create booking
    const booking = await Booking.create({
      user_id: req.user._id,
      bike_id,
      promo_id,
      start_time,
      end_time,
      total_amount,
      discount_amount,
      discount_amount,
      final_amount,
      notes,
    });


    // 6. Mark bike as booked immediately
    await Bike.findByIdAndUpdate(bike_id, { status: 'booked' });
    await booking.populate(['bike_id', 'user_id']);

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings  [admin]
exports.getAllBookings = async (req, res, next) => {
  try {
    const { status, user_id, bike_id, from, to, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status)  filter.status  = status;
    if (user_id) filter.user_id = user_id;
    if (bike_id) filter.bike_id = bike_id;
    if (from || to) {
      filter.start_time = {};
      if (from) filter.start_time.$gte = new Date(from);
      if (to)   filter.start_time.$lte = new Date(to);
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .populate('user_id', 'name email')
      .populate('bike_id', 'name brand type')
      .populate('promo_id', 'code discount_type discount_value')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: bookings });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/my  [staff]
exports.getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { user_id: req.user._id };
    if (status) filter.status = status;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .populate('bike_id', 'name brand type images price_per_hour')
      .populate('promo_id', 'code discount_type discount_value')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: bookings });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/:id
exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user_id', 'name email phone')
      .populate('bike_id')
      .populate('promo_id', 'code discount_type discount_value');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // Staff can only view their own bookings
    if (req.user.role === 'staff' && booking.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/bookings/:id/status
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // Staff can only update their own bookings
    if (req.user.role === 'staff' && booking.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    booking.status = status;
    if (status === 'cancelled') {
      booking.cancelled_at = new Date();
      booking.cancelled_by = req.user._id;
    }
    await booking.save();

    // Sync bike status with booking lifecycle
    if (status === 'confirmed' || status === 'active') {
      await Bike.findByIdAndUpdate(booking.bike_id, { status: 'booked' });
    }
    if (status === 'completed' || status === 'cancelled') {
      await Bike.findByIdAndUpdate(booking.bike_id, { status: 'available' });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// PUT /api/bookings/:id  [admin]
exports.updateBooking = async (req, res, next) => {
  try {
    const { start_time, end_time, notes } = req.body;
    const booking = await Booking.findById(req.params.id).populate('bike_id');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    if (start_time && end_time) {
      const conflict = await hasConflict(booking.bike_id._id, new Date(start_time), new Date(end_time), booking._id);
      if (conflict) return res.status(409).json({ success: false, message: 'New time slot conflicts with an existing booking.' });

      const durationHours   = (new Date(end_time) - new Date(start_time)) / (1000 * 60 * 60);
      booking.start_time    = start_time;
      booking.end_time      = end_time;
      booking.total_amount  = calcAmount(booking.bike_id, durationHours);
      const ad = Math.max(0, booking.total_amount - booking.discount_amount);
      booking.final_amount  = Math.round((ad + ad * GST_RATE) * 100) / 100;
    }

    if (notes !== undefined) booking.notes = notes;
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/bookings/:id  [admin]
exports.deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    res.json({ success: true, message: 'Booking deleted.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/bookings/stats  [admin]
exports.getStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);

    const matchStage = Object.keys(dateFilter).length ? { start_time: dateFilter } : {};

    const [statusStats, revenueStats, popularBikes] = await Promise.all([
      Booking.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { ...matchStage, status: { $in: ['completed'] } } },
        { $group: { _id: null, total_revenue: { $sum: '$final_amount' }, total_bookings: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: matchStage },
        { $group: { _id: '$bike_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'bikes', localField: '_id', foreignField: '_id', as: 'bike' } },
        { $unwind: '$bike' },
        { $project: { count: 1, 'bike.name': 1, 'bike.brand': 1, 'bike.type': 1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        by_status:    statusStats,
        revenue:      revenueStats[0] || { total_revenue: 0, total_bookings: 0 },
        popular_bikes: popularBikes,
      },
    });
  } catch (err) {
    next(err);
  }
};
