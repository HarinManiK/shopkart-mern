import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, selectIsPending, selectQuantityInCart } from '../features/cart/cartSlice';

export default function AddToCartButton({ productId, stock, block = false }) {
  const dispatch = useDispatch();
  const quantityInCart = useSelector(selectQuantityInCart(productId));
  const pending = useSelector(selectIsPending(productId));
  const [error, setError] = useState('');

  const outOfStock = stock <= 0;
  const atLimit = quantityInCart >= stock && !outOfStock;

  const handleClick = async () => {
    setError('');
    try {
      await dispatch(addToCart(productId)).unwrap();
    } catch (message) {
      setError(typeof message === 'string' ? message : 'Could not add to cart');
    }
  };

  let label = quantityInCart > 0 ? 'Add Another' : 'Add to Cart';
  if (pending) label = 'Adding...';
  else if (outOfStock) label = 'Out of Stock';
  else if (atLimit) label = 'Max quantity in cart';

  return (
    <>
      <button
        type="button"
        className={`btn btn-primary ${block ? 'btn-block' : ''}`}
        onClick={handleClick}
        disabled={pending || outOfStock || atLimit}
      >
        {label}
      </button>
      {quantityInCart > 0 && !error && <span className="in-cart-note">{quantityInCart} in cart</span>}
      {error && <span className="inline-error" role="alert">{error}</span>}
    </>
  );
}
