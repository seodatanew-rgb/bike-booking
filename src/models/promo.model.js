const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type:      String,
      required:  [true, 'Promo code is required'],
      unique:    true,
      uppercase: true,
      trim:      true,
      maxlength: [20, 'Code cannot exceed 20 characters'],
    },
    discount_type: {
      type:     String,
      enum:     ['percent', 'flat'],
      required: [true, 'Discount type is required'],
    },
    discount_value: {
      type:     Number,
      required: [true, 'Discount value is required'],
      min:      [0, 'Discount value cannot be negative'],
    },
    min_booking_amount: {
      type:    Number,
      default: 0,
      min:     0,
    },
    usage_limit: {
      type:    Number,
      default: null, // null = unlimited
    },
    used_count: {
      type:    Number,
      default: 0,
    },
    expires_at: {
      type:    Date,
      default: null, // null = no expiry
    },
    is_active: {
      type:    Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Validate percent discount ≤ 100
promoCodeSchema.pre('validate', function (next) {
  if (this.discount_type === 'percent' && this.discount_value > 100) {
    this.invalidate('discount_value', 'Percent discount cannot exceed 100');
  }
  next();
});

module.exports = mongoose.model('PromoCode', promoCodeSchema);
