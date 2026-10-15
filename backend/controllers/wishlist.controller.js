const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const isValidObjectId = require('../utils/isValidObjectId');

const PRODUCT_FIELDS = 'name price category image stock';

// Shared guard: validates :productId and makes sure the product exists.
// Returns an error response (and null) if the request should stop.
const loadProduct = async (productId, res) => {
  if (!isValidObjectId(productId)) {
    res.status(400).json({ success: false, message: 'Invalid product ID' });
    return null;
  }
  const product = await Product.findById(productId).select('_id');
  if (!product) {
    res.status(404).json({ success: false, message: 'Product not found' });
    return null;
  }
  return product;
};

// The user ALWAYS comes from the auth middleware (req.user) - never from the body or URL.
const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!(await loadProduct(productId, res))) return;

    // Atomic: only matches if the product is NOT already in the array, so two
    // simultaneous clicks cannot create a duplicate.
    const result = await Customer.updateOne(
      { _id: req.user._id, wishlist: { $ne: productId } },
      { $addToSet: { wishlist: productId } }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({ success: false, message: 'Product already in wishlist' });
    }
    return res.status(201).json({ success: true, message: 'Product added to wishlist' });
  } catch (error) {
    console.error('Error in addToWishlist:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error adding to wishlist' });
  }
};

const getWishlist = async (req, res) => {
  try {
    const customer = await Customer.findById(req.user._id).populate({
      path: 'wishlist',
      select: PRODUCT_FIELDS
    });

    return res.status(200).json({
      success: true,
      count: customer.wishlist.length,
      wishlist: customer.wishlist
    });
  } catch (error) {
    console.error('Error in getWishlist:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error fetching wishlist' });
  }
};

// Cheap endpoint for the navbar badge (bonus) - no populate needed.
const getWishlistCount = async (req, res) => {
  return res.status(200).json({ success: true, count: req.user.wishlist.length });
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    // Only matches if the product is actually in this user's wishlist.
    const result = await Customer.updateOne(
      { _id: req.user._id, wishlist: productId },
      { $pull: { wishlist: productId } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not in wishlist' });
    }
    return res.status(200).json({ success: true, message: 'Product removed from wishlist' });
  } catch (error) {
    console.error('Error in removeFromWishlist:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error removing from wishlist' });
  }
};

// Bonus: one endpoint that flips the saved state.
const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!(await loadProduct(productId, res))) return;

    const alreadySaved = req.user.wishlist.some((id) => id.toString() === productId);
    await Customer.updateOne(
      { _id: req.user._id },
      alreadySaved ? { $pull: { wishlist: productId } } : { $addToSet: { wishlist: productId } }
    );

    return res.status(200).json({
      success: true,
      saved: !alreadySaved,
      message: alreadySaved ? 'Product removed from wishlist' : 'Product added to wishlist'
    });
  } catch (error) {
    console.error('Error in toggleWishlist:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error toggling wishlist' });
  }
};

module.exports = { addToWishlist, getWishlist, getWishlistCount, removeFromWishlist, toggleWishlist };
