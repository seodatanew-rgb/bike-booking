const PromoCode = require('../models/promo.model');

// POST /api/promos/validate
exports.validatePromo = async (req, res, next) => {
  try {
    const { code, booking_amount } = req.body;

    const promo = await PromoCode.findOne({ code: code.toUpperCase(), is_active: true });
    if (!promo) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive promo code.' });
    }
    if (promo.expires_at && promo.expires_at < new Date()) {
      return res.status(400).json({ success: false, message: 'Promo code has expired.' });
    }
    if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
      return res.status(400).json({ success: false, message: 'Promo code usage limit reached.' });
    }
    if (booking_amount < promo.min_booking_amount) {
      return res.status(400).json({
        success: false,
        message: `Minimum booking amount of ${promo.min_booking_amount} required.`,
      });
    }

    const discount_amount = promo.discount_type === 'percent'
      ? Math.min((booking_amount * promo.discount_value) / 100, booking_amount)
      : Math.min(promo.discount_value, booking_amount);

    res.json({
      success: true,
      data: {
        code:            promo.code,
        discount_type:   promo.discount_type,
        discount_value:  promo.discount_value,
        discount_amount,
        final_amount:    booking_amount - discount_amount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/promos  [admin]
exports.getPromos = async (req, res, next) => {
  try {
    const promos = await PromoCode.find().sort({ createdAt: -1 });
    res.json({ success: true, data: promos });
  } catch (err) {
    next(err);
  }
};

// POST /api/promos  [admin]
exports.createPromo = async (req, res, next) => {
  try {
    const promo = await PromoCode.create(req.body);
    res.status(201).json({ success: true, data: promo });
  } catch (err) {
    next(err);
  }
};

// PUT /api/promos/:id  [admin]
exports.updatePromo = async (req, res, next) => {
  try {
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!promo) return res.status(404).json({ success: false, message: 'Promo code not found.' });
    res.json({ success: true, data: promo });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/promos/:id/toggle  [admin]
exports.togglePromo = async (req, res, next) => {
  try {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promo code not found.' });
    promo.is_active = !promo.is_active;
    await promo.save();
    res.json({ success: true, data: promo, message: `Promo ${promo.is_active ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/promos/:id  [admin]
exports.deletePromo = async (req, res, next) => {
  try {
    const promo = await PromoCode.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promo code not found.' });
    res.json({ success: true, message: 'Promo code deleted.' });
  } catch (err) {
    next(err);
  }
};
