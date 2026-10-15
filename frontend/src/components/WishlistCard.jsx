import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage, removeFromWishlist } from '../services/api';
import { formatPrice, stockInfo } from '../utils/format';
import ProductImage from './ProductImage';

export default function WishlistCard({ product, onRemoved }) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const stock = stockInfo(product.stock);

  const handleRemove = async () => {
    setRemoving(true);
    setError('');
    try {
      await removeFromWishlist(product._id);
      onRemoved(product._id);
    } catch (err) {
      if (err.response?.status === 404) onRemoved(product._id); // already removed elsewhere
      else {
        setError(getErrorMessage(err, 'Could not remove. Please try again.'));
        setRemoving(false);
      }
    }
  };

  return (
    <article className="product-card">
      <Link to={`/products/${product._id}`} className="thumb">
        <ProductImage src={product.image} alt={product.name} />
      </Link>
      <div className="body">
        <span className="category">{product.category}</span>
        <h4>{product.name}</h4>
        <span className="price">{formatPrice(product.price)}</span>
        <span className={`stock ${stock.className}`}>{stock.label}</span>
        <div className="actions">
          <Link to={`/products/${product._id}`} className="btn btn-subtle">View Details</Link>
          <button type="button" className="btn btn-outline-danger" onClick={handleRemove} disabled={removing}>
            {removing ? 'Removing...' : 'Remove ♥'}
          </button>
          {error && <span className="inline-error" role="alert">{error}</span>}
        </div>
      </div>
    </article>
  );
}
