const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    booking_id: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Booking',
      required: true,
      unique:   true, // one review per booking
    },
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
    rating: {
      type:     Number,
      required: [true, 'Rating is required'],
      min:      [1, 'Rating must be at least 1'],
      max:      [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type:  String,
      trim:  true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
  },
  { timestamps: true }
);

reviewSchema.index({ bike_id: 1 });
reviewSchema.index({ user_id: 1 });

// Recalculate bike's avg_rating and review_count after save or delete
reviewSchema.statics.recalcBikeRating = async function (bikeId) {
  const result = await this.aggregate([
    { $match: { bike_id: bikeId } },
    {
      $group: {
        _id:   '$bike_id',
        avg:   { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const Bike = mongoose.model('Bike');
  if (result.length > 0) {
    await Bike.findByIdAndUpdate(bikeId, {
      avg_rating:   Math.round(result[0].avg * 10) / 10,
      review_count: result[0].count,
    });
  } else {
    await Bike.findByIdAndUpdate(bikeId, { avg_rating: 0, review_count: 0 });
  }
};

reviewSchema.post('save', function () {
  this.constructor.recalcBikeRating(this.bike_id);
});

reviewSchema.post('findOneAndDelete', function (doc) {
  if (doc) doc.constructor.recalcBikeRating(doc.bike_id);
});

module.exports = mongoose.model('Review', reviewSchema);
