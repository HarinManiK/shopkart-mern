import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCart, selectCartError, selectCartItems, selectCartStatus } from '../features/cart/cartSlice';
import CartItem from '../components/CartItem';
import OrderSummary from '../components/OrderSummary';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';

export default function Cart() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector(selectCartItems);
  const status = useSelector(selectCartStatus);
  const error = useSelector(selectCartError);

  if (status === 'idle' || (status === 'loading' && items.length === 0)) {
    return <Loading message="Loading your cart..." />;
  }
  if (status === 'failed') {
    return <ErrorState title="Unable to load your cart." message={error} onRetry={() => dispatch(fetchCart())} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        title="Your cart is empty"
        message="Looks like you haven't added anything yet."
        actionLabel="Browse Products"
        actionTo="/products"
      />
    );
  }

  const hasStockProblem = items.some((row) => row.quantity > row.product.stock);

  return (
    <div className="page">
      <h1 className="page-title">My Cart</h1>
      <div className="cart-layout">
        <div className="form-card">
          {items.map((item) => (
            <CartItem key={item.product._id} item={item} />
          ))}
        </div>
        <OrderSummary items={items}>
          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}
            disabled={hasStockProblem}
            onClick={() => navigate('/checkout')}
          >
            Proceed to Checkout
          </button>
          {hasStockProblem && <p className="inline-error" style={{ marginTop: 8 }}>Fix the stock issues above first.</p>}
          <p style={{ marginTop: 12, textAlign: 'center' }}>
            <Link to="/products">Continue shopping</Link>
          </p>
        </OrderSummary>
      </div>
    </div>
  );
}
