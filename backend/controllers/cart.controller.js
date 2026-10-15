const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const isValidObjectId = require('../utils/isValidObjectId');

const PRODUCT_FIELDS = 'name price category image stock';

// Loads the customer's cart with live Product data. Rows whose product has been
// deleted from the catalogue are dropped from the response.
const getPopulatedCart = async (customerId) => {
  const customer = await Customer.findById(customerId).populate({
    path: 'cart.product',
    select: PRODUCT_FIELDS
  });
  return customer.cart
    .filter((row) => row.product)
    .map((row) => ({ product: row.product, quantity: row.quantity }));
};

const badRequest = (res, message) => res.status(400).json({ success: false, message });

const addToCart = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) return badRequest(res, 'Invalid product ID');

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.stock < 1) return badRequest(res, `${product.name} is out of stock`);

    const customerId = req.user._id;

    // The stock limit lives INSIDE the update condition, so two simultaneous requests
    // can never push the quantity past stock (a read-then-save could).
    let updated = false;
    for (let attempt = 0; attempt < 3 && !updated; attempt += 1) {
      // 1) Already in the cart and still below stock -> quantity + 1
      const inc = await Customer.updateOne(
        { _id: customerId, cart: { $elemMatch: { product: productId, quantity: { $lt: product.stock } } } },
        { $inc: { 'cart.$.quantity': 1 } }
      );
      if (inc.modifiedCount === 1) {
        updated = true;
        break;
      }

      // 2) Already in the cart but at the stock limit -> reject
      const existing = await Customer.exists({ _id: customerId, 'cart.product': productId });
      if (existing) {
        return badRequest(res, `Only ${product.stock} unit(s) of ${product.name} available`);
      }

      // 3) Not in the cart yet -> add a new row (guarded so we never create a duplicate row)
      const push = await Customer.updateOne(
        { _id: customerId, 'cart.product': { $ne: productId } },
        { $push: { cart: { product: productId, quantity: 1 } } }
      );
      updated = push.modifiedCount === 1; // if it lost a race, loop and take path 1
    }

    return res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: await getPopulatedCart(customerId)
    });
  } catch (error) {
    console.error('Error in addToCart:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error updating cart' });
  }
};

const getCart = async (req, res) => {
  try {
    return res.status(200).json({ success: true, cart: await getPopulatedCart(req.user._id) });
  } catch (error) {
    console.error('Error in getCart:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error fetching cart' });
  }
};

const updateQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!isValidObjectId(productId)) return badRequest(res, 'Invalid product ID');
    if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
      return badRequest(res, 'Quantity must be a whole number');
    }
    if (quantity < 1) return badRequest(res, 'Quantity must be at least 1');

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (quantity > product.stock) {
      return badRequest(res, `Only ${product.stock} unit(s) of ${product.name} available`);
    }

    const result = await Customer.updateOne(
      { _id: req.user._id, 'cart.product': productId },
      { $set: { 'cart.$.quantity': quantity } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    return res.status(200).json({
      success: true,
      message: 'Cart updated',
      cart: await getPopulatedCart(req.user._id)
    });
  } catch (error) {
    console.error('Error in updateQuantity:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error updating quantity' });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId)) return badRequest(res, 'Invalid product ID');

    // No product lookup on purpose: a customer must be able to remove a row even
    // if the product was deleted from the catalogue.
    const result = await Customer.updateOne(
      { _id: req.user._id, 'cart.product': productId },
      { $pull: { cart: { product: productId } } }
    );
    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    return res.status(200).json({
      success: true,
      message: 'Product removed from cart',
      cart: await getPopulatedCart(req.user._id)
    });
  } catch (error) {
    console.error('Error in removeFromCart:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error removing from cart' });
  }
};

module.exports = { addToCart, getCart, updateQuantity, removeFromCart, getPopulatedCart };
