const Customer = require('../models/customer.model');
const Product = require('../models/product.model');
const Order = require('../models/order.model');
const razorpay = require('../config/razorpay');
const isValidObjectId = require('../utils/isValidObjectId');

const badRequest = (res, message) => res.status(400).json({ success: false, message });

// ---- shipping address validation (the server never trusts the client's checks) ----
const ADDRESS_FIELDS = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];

const validateShippingAddress = (address) => {
  if (!address || typeof address !== 'object') return { error: 'Shipping address is required' };

  const cleaned = {};
  for (const field of ADDRESS_FIELDS) {
    const value = typeof address[field] === 'string' ? address[field].trim() : '';
    if (!value) return { error: `Shipping address: ${field} is required` };
    cleaned[field] = value;
  }
  if (!/^\d{10}$/.test(cleaned.phone)) return { error: 'Phone number must contain 10 digits' };
  if (!/^\d{6}$/.test(cleaned.pincode)) return { error: 'Pincode must contain 6 digits' };
  return { address: cleaned };
};

// POST /orders/create-payment-order
const createPaymentOrder = async (req, res) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Payment gateway is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env.'
      });
    }

    // Only the shipping address is read from the body. Any totalAmount / prices / items
    // the client sends are ignored: the server rebuilds everything from the DB.
    const { address, error } = validateShippingAddress(req.body.shippingAddress);
    if (error) return badRequest(res, error);

    const customer = await Customer.findById(req.user._id).populate('cart.product');
    if (!customer.cart.length) return badRequest(res, 'Your cart is empty');

    // Re-validate every line against the LATEST product data (stock/price may have changed).
    const items = [];
    for (const row of customer.cart) {
      const product = row.product;
      if (!product) return badRequest(res, 'A product in your cart is no longer available. Please remove it and try again.');
      if (product.stock < row.quantity) {
        return badRequest(
          res,
          product.stock === 0
            ? `${product.name} is out of stock.`
            : `Insufficient stock for ${product.name}. Only ${product.stock} available.`
        );
      }
      items.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: row.quantity,
        image: product.image
      });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // A new attempt supersedes any earlier unpaid attempt, so abandoned checkouts don't pile up.
    await Order.updateMany(
      { user: req.user._id, paymentStatus: 'PENDING' },
      { $set: { paymentStatus: 'FAILED' } }
    );

    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress: address,
      totalAmount
    });

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.getClient().orders.create({
        amount: Math.round(totalAmount * 100), // Razorpay wants paise (1 INR = 100 paise)
        currency: 'INR',
        receipt: order._id.toString()
      });
    } catch (gatewayError) {
      console.error('Razorpay order creation failed:', gatewayError.error || gatewayError.message);
      await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'FAILED' } });
      return res.status(502).json({
        success: false,
        message: 'Could not start the payment. Please try again in a moment.'
      });
    }

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    // Safe to send: the public Key ID. The Key SECRET never leaves the server.
    return res.status(201).json({
      success: true,
      shopKartOrderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: razorpay.getKeyId()
    });
  } catch (error) {
    console.error('Error in createPaymentOrder:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error creating payment order' });
  }
};

// Reduce stock for a paid order. Floors at 0 and never throws: the money is already
// captured, so we must not fail the order if stock moved in the meantime.
const deductStock = async (items) => {
  await Promise.all(
    items.map((item) =>
      Product.updateOne({ _id: item.product }, [
        { $set: { stock: { $max: [0, { $subtract: ['$stock', item.quantity] }] } } }
      ])
    )
  );
};

// POST /orders/verify-payment
const verifyPayment = async (req, res) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({ success: false, message: 'Payment gateway is not configured' });
    }

    const { shopKartOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!shopKartOrderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return badRequest(res, 'shopKartOrderId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
    }
    if (!isValidObjectId(String(shopKartOrderId))) return badRequest(res, 'Invalid order ID');

    // Only the owner's order can be verified.
    const order = await Order.findOne({ _id: shopKartOrderId, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Already confirmed (double-click / retry): answer idempotently, change nothing.
    if (order.paymentStatus === 'PAID') {
      return res.status(200).json({ success: true, message: 'Order already confirmed', order });
    }
    if (order.paymentStatus === 'FAILED' || !order.razorpayOrderId) {
      return badRequest(res, 'This payment attempt is no longer valid. Please start checkout again.');
    }

    // The order id used for the signature comes from OUR database, not from the browser.
    // The browser's copy must simply agree with it.
    if (razorpay_order_id !== order.razorpayOrderId) {
      return badRequest(res, 'Payment does not belong to this order');
    }
    if (!razorpay.isValidSignature(order.razorpayOrderId, razorpay_payment_id, razorpay_signature)) {
      return badRequest(res, 'Invalid payment signature');
    }

    // Atomic PENDING -> PAID transition: if two verify calls race, only one wins.
    const confirmed = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: 'PENDING' },
      { $set: { paymentStatus: 'PAID', status: 'PLACED', razorpayPaymentId: razorpay_payment_id } },
      { new: true }
    );
    if (!confirmed) {
      const current = await Order.findById(order._id);
      return res.status(200).json({ success: true, message: 'Order already confirmed', order: current });
    }

    await deductStock(confirmed.items);
    await Customer.updateOne({ _id: req.user._id }, { $set: { cart: [] } }); // cleared ONLY after verified payment

    return res.status(200).json({ success: true, message: 'Payment verified. Order placed.', order: confirmed });
  } catch (error) {
    console.error('Error in verifyPayment:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error verifying payment' });
  }
};

// GET /orders - order history = orders that were actually paid, newest first.
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id, paymentStatus: 'PAID' }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error('Error in getOrders:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error fetching orders' });
  }
};

// GET /orders/:id - the query includes the owner, so someone else's id is simply "not found".
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return badRequest(res, 'Invalid order ID');

    const order = await Order.findOne({ _id: id, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Error in getOrderById:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error fetching order' });
  }
};

// Bonus: development-only helper to walk an order through its lifecycle.
const STATUS_FLOW = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

const advanceOrderStatus = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }
    const { id } = req.params;
    if (!isValidObjectId(id)) return badRequest(res, 'Invalid order ID');

    const order = await Order.findOne({ _id: id, user: req.user._id, paymentStatus: 'PAID' });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const next = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];
    if (!next) return badRequest(res, 'Order is already delivered');

    order.status = next;
    await order.save();
    return res.status(200).json({ success: true, message: `Order is now ${next}`, order });
  } catch (error) {
    console.error('Error in advanceOrderStatus:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error updating status' });
  }
};

module.exports = { createPaymentOrder, verifyPayment, getOrders, getOrderById, advanceOrderStatus };
