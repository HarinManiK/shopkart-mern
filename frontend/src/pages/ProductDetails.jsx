import { Link, useParams } from 'react-router-dom';
import { fetchProduct } from '../services/api';
import useFetch from '../hooks/useFetch';
import ProductImage from '../components/ProductImage';
import AddToCartButton from '../components/AddToCartButton';
import { ErrorState, Loading } from '../components/StateViews';
import { formatPrice, stockInfo } from '../utils/format';

export default function ProductDetails() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(id, (signal) => fetchProduct(id, { signal }));

  if (loading) return <Loading message="Loading product..." />;

  if (error) {
    const code = error.response?.status;
    if (code === 404 || code === 400) {
      return (
        <div className="state-box">
          <h3>Product not found</h3>
          <p>This product doesn't exist or was removed.</p>
          <Link to="/products" className="btn btn-primary">Back to Products</Link>
        </div>
      );
    }
    return <ErrorState title="Something went wrong while loading this product." onRetry={reload} />;
  }

  const product = data.product;
  const stock = stockInfo(product.stock);

  return (
    <div className="page">
      <Link to="/products">← Back to products</Link>
      <div className="form-card details">
        <div className="big-img">
          <ProductImage src={product.image} alt={product.name} />
        </div>
        <div className="info">
          <span className="category">{product.category}</span>
          <h2>{product.name}</h2>
          <span className="price">{formatPrice(product.price)}</span>
          <span className={`stock ${stock.className}`}>{stock.label}</span>
          <p>{product.description}</p>
          <div className="btn-row">
            <AddToCartButton productId={product._id} stock={product.stock} />
          </div>
        </div>
      </div>
    </div>
  );
}
