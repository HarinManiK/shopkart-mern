const express = require('express');
const router = express.Router();

const { createProduct, getProducts, getProductById } = require('../controllers/product.controller');

// Browsing is public. Product creation is intentionally open for Lab 03; the
// spec says admin protection will come later.
router.post('/', createProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);

module.exports = router;
