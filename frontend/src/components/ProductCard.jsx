import { Link } from 'react-router-dom';
import { formatPrice, stockInfo } from '../utils/format';
import ProductImage from './ProductImage';
import WishlistButton from './WishlistButton';
import AddToCartButton from './AddToCartButton';

export default function ProductCard({ product, wishlisted, onWishlistChange }) {
  const stock = stockInfo(product.stock);

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
          <Link to={`/products/${product._id}`} className="btn btn-subtle">
            View Details
          </Link>
          <AddToCartButton productId={product._id} stock={product.stock} block />
          <WishlistButton
            productId={product._id}
            saved={wishlisted}
            onChange={(saved) => onWishlistChange(product._id, saved)}
          />
        </div>
      </div>
    </article>
  );
}
