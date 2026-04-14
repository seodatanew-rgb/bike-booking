const mongoose = require('mongoose');

const bikeSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Bike name is required'],
      trim:     true,
    },
    brand: {
      type:     String,
      required: [true, 'Brand is required'],
      trim:     true,
    },
    type: {
      type:     String,
      required: [true, 'Bike type is required'],
      enum:     ['petrol-scooter', 'e-scooter', 'petrol-bike', 'premium-bike'],
    },
    description: {
      type:  String,
      trim:  true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    price_per_hour: {
      type:     Number,
      required: [true, 'Price per hour is required'],
      min:      [0, 'Price cannot be negative'],
    },
    price_per_day: {
      type:     Number,
      required: [true, 'Price per day is required'],
      min:      [0, 'Price cannot be negative'],
    },
    status: {
      type:    String,
      enum:    ['available', 'booked', 'maintenance', 'retired'],
      default: 'available',
    },
    images: [
      {
        type: String,
      },
    ],
    location: {
      type:     String,
      required: [true, 'Location is required'],
      trim:     true,
    },
    avg_rating: {
      type:    Number,
      default: 0,
      min:     0,
      max:     5,
    },
    review_count: {
      type:    Number,
      default: 0,
    },
    is_active: {
      type:    Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index for search/filter queries
bikeSchema.index({ type: 1, status: 1, location: 1 });
bikeSchema.index({ price_per_hour: 1 });

module.exports = mongoose.model('Bike', bikeSchema);
