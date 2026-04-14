const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    bike_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Bike',
      required: true,
    },
    promo_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'PromoCode',
      default: null,
    },
    start_time: {
      type:     Date,
      required: [true, 'Start time is required'],
    },
    end_time: {
      type:     Date,
      required: [true, 'End time is required'],
    },
    // Duration in hours (computed on creation)
    duration_hours: {
      type: Number,
    },
    total_amount: {
      type:     Number,
      required: true,
      min:      0,
    },
    discount_amount: {
      type:    Number,
      default: 0,
    },
    final_amount: {
      type:     Number,
      required: true,
      min:      0,
    },
    status: {
      type:    String,
      enum:    ['pending', 'confirmed', 'active', 'completed', 'cancelled'],
      default: 'pending',
    },
    notes: {
      type:  String,
      trim:  true,
      maxlength: [300, 'Notes cannot exceed 300 characters'],
    },
    cancelled_at: {
      type: Date,
    },
    cancelled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
  },
  { timestamps: true }
);

// Validate end_time > start_time
bookingSchema.pre('validate', function (next) {
  if (this.start_time && this.end_time && this.end_time <= this.start_time) {
    this.invalidate('end_time', 'End time must be after start time');
  }
  next();
});

// Auto-compute duration_hours before saving
bookingSchema.pre('save', function (next) {
  if (this.start_time && this.end_time) {
    this.duration_hours = (this.end_time - this.start_time) / (1000 * 60 * 60);
  }
  next();
});

// Indexes for availability checks and filtering
bookingSchema.index({ bike_id: 1, status: 1, start_time: 1, end_time: 1 });
bookingSchema.index({ user_id: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
