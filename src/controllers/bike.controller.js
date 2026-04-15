const path    = require('path');
const fs      = require('fs');
const Bike    = require('../models/bike.model');
const Booking = require('../models/booking.model');

// GET /api/bikes
exports.getBikes = async (req, res, next) => {
  try {
    const { type, status, location, min_price, max_price, sort, page = 1, limit = 10 } = req.query;

    const filter = { is_active: true };
    if (type)     filter.type     = type;
    if (status)   filter.status   = status;
    if (location) filter.location = new RegExp(location, 'i');
    if (min_price || max_price) {
      filter.price_per_day = {};
      if (min_price) filter.price_per_day.$gte = Number(min_price);
      if (max_price) filter.price_per_day.$lte = Number(max_price);
    }

    const sortMap = {
      price_asc:    { price_per_day: 1 },
      price_desc:   { price_per_day: -1 },
      rating_desc:  { avg_rating: -1 },
      newest:       { createdAt: -1 },
    };
    const sortOption = sortMap[sort] || { createdAt: -1 };

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Bike.countDocuments(filter);
    const bikes = await Bike.find(filter).sort(sortOption).skip(skip).limit(Number(limit));

    res.json({
      success: true,
      total,
      page:    Number(page),
      pages:   Math.ceil(total / Number(limit)),
      data:    bikes,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/bikes/:id
exports.getBike = async (req, res, next) => {
  try {
    const bike = await Bike.findOne({ _id: req.params.id, is_active: true });
    if (!bike) return res.status(404).json({ success: false, message: 'Bike not found.' });
    res.json({ success: true, data: bike });
  } catch (err) {
    next(err);
  }
};

// POST /api/bikes  [admin]
exports.createBike = async (req, res, next) => {
  try {
    const bike = await Bike.create(req.body);
    res.status(201).json({ success: true, data: bike });
  } catch (err) {
    next(err);
  }
};

// PUT /api/bikes/:id  [admin]
exports.updateBike = async (req, res, next) => {
  try {
    const bike = await Bike.findByIdAndUpdate(req.params.id, req.body, {
      new:           true,
      runValidators: true,
    });
    if (!bike) return res.status(404).json({ success: false, message: 'Bike not found.' });
    res.json({ success: true, data: bike });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/bikes/:id/status  [admin, staff]
exports.updateBikeStatus = async (req, res, next) => {
  try {
    const bike = await Bike.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!bike) return res.status(404).json({ success: false, message: 'Bike not found.' });
    res.json({ success: true, data: bike });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/bikes/:id  [admin] — soft delete
exports.deleteBike = async (req, res, next) => {
  try {
    const bike = await Bike.findByIdAndUpdate(req.params.id, { is_active: false }, { new: true });
    if (!bike) return res.status(404).json({ success: false, message: 'Bike not found.' });
    res.json({ success: true, message: 'Bike removed from fleet.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/bikes/:id/images  [admin] — upload 1–5 images
exports.uploadImages = async (req, res, next) => {
  try {
    const bike = await Bike.findById(req.params.id);
    if (!bike) return res.status(404).json({ success: false, message: 'Bike not found.' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded.' });
    }

    const remaining = 5 - bike.images.length;
    if (remaining <= 0) {
      // Clean up uploaded files since we won't use them
      req.files.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(400).json({ success: false, message: 'Bike already has 5 images (the maximum).' });
    }

    // Accept only as many files as slots remain
    const accepted = req.files.slice(0, remaining);
    const rejected = req.files.slice(remaining);
    rejected.forEach(f => fs.unlink(f.path, () => {}));

    // Build public URLs  e.g.  /uploads/bikes/bike-123456.jpg
    const urls = accepted.map(f => `/uploads/bikes/${f.filename}`);
    bike.images.push(...urls);
    await bike.save();

    res.status(201).json({
      success: true,
      message: `${urls.length} image(s) uploaded.`,
      data:    bike,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/bikes/:id/images  [admin] — remove one image by filename
exports.deleteImage = async (req, res, next) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ success: false, message: 'filename is required.' });

    const bike = await Bike.findById(req.params.id);
    if (!bike) return res.status(404).json({ success: false, message: 'Bike not found.' });

    const imageUrl = `/uploads/bikes/${filename}`;
    if (!bike.images.includes(imageUrl)) {
      return res.status(404).json({ success: false, message: 'Image not found on this bike.' });
    }

    // Remove from DB
    bike.images = bike.images.filter(img => img !== imageUrl);
    await bike.save();

    // Delete from disk (non-blocking — don't fail if file is already gone)
    const filePath = path.join(__dirname, '../../uploads/bikes', filename);
    fs.unlink(filePath, () => {});

    res.json({ success: true, message: 'Image deleted.', data: bike });
  } catch (err) {
    next(err);
  }
};

// GET /api/bikes/availability?bike_id=&start=&end=
exports.checkAvailability = async (req, res, next) => {
  try {
    const { bike_id, start, end } = req.query;
    if (!bike_id || !start || !end) {
      return res.status(400).json({ success: false, message: 'bike_id, start, and end are required.' });
    }

    const conflict = await Booking.findOne({
      bike_id,
      status: { $in: ['pending', 'confirmed', 'active'] },
      $or: [
        { start_time: { $lt: new Date(end) }, end_time: { $gt: new Date(start) } },
      ],
    });

    res.json({ success: true, available: !conflict });
  } catch (err) {
    next(err);
  }
};
