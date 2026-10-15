const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    // Wishlist stores Product *references* (ObjectIds), never copies of products.
    // The Product collection stays the single source of truth for price/stock/etc.
    wishlist: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
      default: []
    },
    // Cart rows reference a Product and add the one thing a wishlist doesn't need: quantity.
    // Price/name/stock are NOT copied here - they are always read from the live Product.
    cart: {
      type: [
        {
          _id: false,
          product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
          quantity: { type: Number, default: 1, min: [1, 'Quantity must be at least 1'] }
        }
      ],
      default: []
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    // Prevent Mongoose internal version key __v from cluttering responses
    versionKey: false
  }
);

// Safety mechanism: Ensure password is never exposed in JSON responses
customerSchema.methods.toJSON = function () {
  const customerObject = this.toObject();
  delete customerObject.password;
  return customerObject;
};

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
