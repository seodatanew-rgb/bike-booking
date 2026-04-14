const Review  = require('../models/review.model');
const Booking = require('../models/booking.model');

// POST /api/reviews
exports.createReview = async (req, res, next) => {
  try {
    const { booking_id, rating, comment } = req.body;

    // Booking must exist, be completed, and belong to the user
    const booking = await Booking.findOne({
      _id:     booking_id,
      user_id: req.user._id,
      status:  'completed',
    });
    if (!booking) {
      return res.status(400).json({
        success: false,
        message: 'Booking not found, not completed, or does not belong to you.',
      });
    }

    // Prevent duplicate reviews
    const existing = await Review.findOne({ booking_id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already reviewed this booking.' });
    }

    const review = await Review.create({
      booking_id,
      user_id:  req.user._id,
      bike_id:  booking.bike_id,
      rating,
      comment,
    });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
};

// GET /api/reviews/bike/:bike_id
exports.getBikeReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort = 'recent' } = req.query;
    const sortOption = sort === 'highest' ? { rating: -1 } : { createdAt: -1 };

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Review.countDocuments({ bike_id: req.params.bike_id });
    const reviews = await Review.find({ bike_id: req.params.bike_id })
      .populate('user_id', 'name')
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: reviews });
  } catch (err) {
    next(err);
  }
};

// GET /api/reviews/my
exports.getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ user_id: req.user._id })
      .populate('bike_id', 'name brand type images')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
};

// PUT /api/reviews/:id
exports.updateReview = async (req, res, next) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, user_id: req.user._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

    // Allow edits within 7 days of creation
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - review.createdAt > sevenDays) {
      return res.status(403).json({ success: false, message: 'Reviews can only be edited within 7 days of submission.' });
    }

    const { rating, comment } = req.body;
    if (rating  !== undefined) review.rating  = rating;
    if (comment !== undefined) review.comment = comment;
    await review.save();

    res.json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/reviews/:id  [admin]
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });
    res.json({ success: true, message: 'Review removed.' });
  } catch (err) {
    next(err);
  }
};
