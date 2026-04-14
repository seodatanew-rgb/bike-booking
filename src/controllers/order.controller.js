const Booking          = require('../models/booking.model');
const Bike             = require('../models/bike.model');
const PromoCode        = require('../models/promo.model');
const { sendOrderEmail } = require('../utils/email');

// Helper: check for conflicting bookings
const hasConflict = async (bikeId, startTime, endTime) => {
  return Booking.findOne({
    bike_id: bikeId,
    status:  { $in: ['pending', 'confirmed', 'active'] },
    $or: [{ start_time: { $lt: endTime }, end_time: { $gt: startTime } }],
  });
};

// Helper: calculate booking amount
const GST_RATE = 0.18;

const calcAmount = (bike, durationHours) => {
  const days = Math.ceil(durationHours / 24) || 1;
  return Math.round(days * bike.price_per_day * 100) / 100;
};

// POST /api/orders
exports.placeOrder = async (req, res, next) => {
  try {
    const { customer, items } = req.body;

    // ── Validate customer fields ───────────────────────────────
    if (!customer?.name || !customer?.email || !customer?.phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and phone are required.',
      });
    }
    if (!items?.length) {
      return res.status(400).json({ success: false, message: 'No items in order.' });
    }

    const createdBookings = [];
    const emailBikes      = [];
    const errors          = [];

    // ── Process each item ──────────────────────────────────────
    for (const item of items) {
      const { bike_id, start_time, end_time, promo_code } = item;

      try {
        // 1. Validate bike
        const bike = await Bike.findOne({ _id: bike_id, is_active: true });
        if (!bike) { errors.push(`Bike not found: ${bike_id}`); continue; }
        if (bike.status !== 'available') {
          errors.push(`${bike.name} is currently ${bike.status}.`); continue;
        }

        // 2. Check conflict
        const conflict = await hasConflict(bike_id, new Date(start_time), new Date(end_time));
        if (conflict) {
          errors.push(`${bike.name} is already booked for the selected time.`); continue;
        }

        // 3. Calculate amount
        const durationHours = (new Date(end_time) - new Date(start_time)) / (1000 * 60 * 60);
        const total_amount  = calcAmount(bike, durationHours);

        // 4. Apply promo
        let discount_amount = 0;
        let promo_id        = null;

        if (promo_code) {
          const promo = await PromoCode.findOne({ code: promo_code.toUpperCase(), is_active: true });
          if (promo && (!promo.expires_at || promo.expires_at > new Date()) &&
              (promo.usage_limit === null || promo.used_count < promo.usage_limit) &&
              total_amount >= promo.min_booking_amount) {
            discount_amount = promo.discount_type === 'percent'
              ? Math.min((total_amount * promo.discount_value) / 100, total_amount)
              : Math.min(promo.discount_value, total_amount);
            promo_id = promo._id;
            await PromoCode.findByIdAndUpdate(promo._id, { $inc: { used_count: 1 } });
          }
        }

        const after_discount = Math.max(0, total_amount - discount_amount);
        const gst_amount     = Math.round(after_discount * GST_RATE * 100) / 100;
        const final_amount   = Math.round((after_discount + gst_amount) * 100) / 100;

        // 5. Create booking (notes includes customer contact)
        const booking = await Booking.create({
          user_id:         req.user._id,
          bike_id,
          promo_id,
          start_time,
          end_time,
          total_amount,
          discount_amount,
          final_amount,
          notes: `Customer: ${customer.name} | Phone: ${customer.phone}${customer.altPhone ? ' / ' + customer.altPhone : ''} | Email: ${customer.email}`,
        });

        // 6. Mark bike as booked
        await Bike.findByIdAndUpdate(bike_id, { status: 'booked' });

        createdBookings.push(booking);

        emailBikes.push({
          name:          bike.name,
          brand:         bike.brand,
          type:          bike.type,
          startTime:     start_time,
          endTime:       end_time,
          days:          Math.ceil(durationHours / 24) || 1,
          totalAmount:   total_amount,
          discountAmount: discount_amount,
          afterDiscount: Math.max(0, total_amount - discount_amount),
          gst:           Math.round(Math.max(0, total_amount - discount_amount) * GST_RATE * 100) / 100,
          finalAmount:   final_amount,
          promoCode:     promo_code || null,
        });

      } catch (itemErr) {
        errors.push(`Error processing item: ${itemErr.message}`);
      }
    }

    if (createdBookings.length === 0) {
      return res.status(400).json({ success: false, message: errors.join('. ') || 'No bookings created.' });
    }

    // ── Send email ─────────────────────────────────────────────
    const grandTotal = emailBikes.reduce((sum, b) => sum + b.finalAmount, 0);

    try {
      await sendOrderEmail({ customer, bikes: emailBikes, total: grandTotal });
    } catch (emailErr) {
      // Don't fail the order if email fails — log it and continue
      console.error('⚠️  Order email failed:', emailErr.message);
    }

    res.status(201).json({
      success:  true,
      message:  `${createdBookings.length} booking(s) placed successfully!`,
      errors:   errors.length ? errors : undefined,
      data:     createdBookings,
    });

  } catch (err) {
    next(err);
  }
};
