const jwt = require('jsonwebtoken');
const Customer = require('../models/customer.model');

/**
 * Authentication Middleware
 * Verifies JWT from HttpOnly cookie, retrieves customer, and attaches to req.user
 */
const protect = async (req, res, next) => {
  try {
    // Extract token from parsed cookies
    const token = req.cookies && req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Access token is missing'
      });
    }

    // Verify token validity and expiration
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Retrieve customer associated with the token payload, excluding password
    const customer = await Customer.findById(decoded.id).select('-password');

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Customer not found'
      });
    }

    // Attach authenticated customer to request object
    req.user = customer;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Invalid or expired token'
    });
  }
};

module.exports = { protect };
