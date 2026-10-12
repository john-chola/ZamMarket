const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    title: {
      type: String,
      required: [true, 'Listing title is required'],
      trim: true,
      maxlength: [80, 'Title cannot exceed 80 characters'],
    },

    charcoalType: {
      type: String,
      enum: ['Hardwood (Miombo)', 'Softwood', 'Mixed', 'Other'],
      default: 'Hardwood (Miombo)',
    },

    pricePerBag: {
      type: Number,
      required: [true, 'Price per bag is required'],
      min: [1, 'Price must be greater than 0'],
    },

    unit: {
      type: String,
      enum: ['bag', 'tin', 'kg'],
      default: 'bag',
    },

    quantityAvailable: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },

    neighbourhood: {
      type: String,
      enum: [
        'Kalingalinga', 'Kanyama', 'Mtendere', 'Chilenje',
        'Matero', 'Bauleni', 'Chelstone', 'Woodlands',
        'Kabwata', 'Libala', 'Lusaka_CBD', 'Munali', 'Roma',
        'Lima', 'Mandevu', 'Makeni', 'Chawama', 'Feira',
        'Kafue West', 'Kafue South', 'Chongwe East', 'Chongwe West',
        'Chilanga South', 'Chilanga North', 'Other',
      ],
      required: [true, 'Neighbourhood is required'],
    },

    description: {
      type: String,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },

    image: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' }, // Cloudinary public_id for deletion
    },

    status: {
      type: String,
      enum: ['active', 'sold', 'paused'],
      default: 'active',
    },

    views: { type: Number, default: 0 },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Index for fast neighbourhood + status queries
listingSchema.index({ neighbourhood: 1, status: 1, createdAt: -1 });
listingSchema.index({ seller: 1, status: 1 });

module.exports = mongoose.model('Listing', listingSchema);