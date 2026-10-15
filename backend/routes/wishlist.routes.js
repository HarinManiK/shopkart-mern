const express = require('express');
const router = express.Router();

const {
  addToWishlist,
  getWishlist,
  getWishlistCount,
  removeFromWishlist,
  toggleWishlist
} = require('../controllers/wishlist.controller');
const { protect } = require('../middlewares/auth.middleware');

// Every wishlist route needs a logged-in customer.
router.use(protect);

router.get('/', getWishlist);
router.get('/count', getWishlistCount);
router.post('/:productId', addToWishlist);
router.patch('/:productId/toggle', toggleWishlist);
router.delete('/:productId', removeFromWishlist);

module.exports = router;
