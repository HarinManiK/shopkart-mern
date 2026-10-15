import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { removeFromCart, selectIsPending, updateQuantity } from '../features/cart/cartSlice';
import { formatPrice } from '../utils/format';
import ProductImage from './ProductImage';

export default function CartItem({ item }) {
  const { product, quantity } = item;
  const dispatch = useDispatch();
  const pending = useSelector(selectIsPending(product._id)); // only THIS row is disabled
  const [error, setError] = useState('');

  const run = async (action) => {
    setError('');
    try {
      await dispatch(action).unwrap();
    } catch (message) {
      setError(typeof message === 'string' ? message : 'Something went wrong');
    }
  };

  const overStock = quantity > product.stock;

  return (
    <div className="cart-item">
      <Link to={`/products/${product._id}`} className="thumb">
        <ProductImage src={product.image} alt={product.name} />
      </Link>
      <div>
        <h4>{product.name}</h4>
        <div className="unit-price">{formatPrice(product.price)} each</div>
        <div className="qty-controls">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={pending || quantity <= 1}
            onClick={() => run(updateQuantity({ productId: product._id, quantity: quantity - 1 }))}
          >
            −
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={pending || quantity >= product.stock}
            onClick={() => run(updateQuantity({ productId: product._id, quantity: quantity + 1 }))}
          >
            +
          </button>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            disabled={pending}
            onClick={() => run(removeFromCart(product._id))}
          >
            {pending ? 'Updating...' : 'Remove'}
          </button>
        </div>
        {overStock && (
          <p className="inline-error">
            Only {product.stock} available now - please reduce the quantity.
          </p>
        )}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      <div className="line-total">{formatPrice(product.price * quantity)}</div>
    </div>
  );
}
