const Product = require('../models/product.model');
const isValidObjectId = require('../utils/isValidObjectId');

// Fields the listing UI needs (description is only used on the details page).
const LIST_FIELDS = 'name price category image stock';

const SORT_OPTIONS = {
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  newest: { createdAt: -1, _id: -1 }
};

// Escape user input so "c++" or "(" is searched literally, not run as a regex.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createProduct = async (req, res) => {
  try {
    const { name, description, price, category, image, stock } = req.body;
    const product = await Product.create({ name, description, price, category, image, stock });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error('Error in createProduct:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error creating product' });
  }
};

const getProducts = async (req, res) => {
  try {
    const { search, category, sort } = req.query;

    // Build the filter dynamically from whichever query params were provided.
    const filter = {};
    if (typeof search === 'string' && search.trim()) {
      filter.name = { $regex: escapeRegex(search.trim()), $options: 'i' };
    }
    if (typeof category === 'string' && category.trim()) {
      filter.category = { $regex: `^${escapeRegex(category.trim())}$`, $options: 'i' };
    }

    const sortBy = SORT_OPTIONS[sort] || SORT_OPTIONS.newest;
    const products = await Product.find(filter).select(LIST_FIELDS).sort(sortBy);

    return res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Error in getProducts:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error fetching products' });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.status(200).json({ success: true, product });
  } catch (error) {
    console.error('Error in getProductById:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error fetching product' });
  }
};

module.exports = { createProduct, getProducts, getProductById };
