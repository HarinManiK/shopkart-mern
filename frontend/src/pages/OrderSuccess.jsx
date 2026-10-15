import { Link, useParams } from 'react-router-dom';
import { fetchOrder } from '../services/api';
import useFetch from '../hooks/useFetch';
import { ErrorState, Loading } from '../components/StateViews';
import { formatPrice } from '../utils/format';

export default function OrderSuccess() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(id, (signal) => fetchOrder(id, { signal }));

  if (loading) return <Loading message="Loading your order..." />;
  if (error) return <ErrorState title="We couldn't load this order." onRetry={reload} />;

  const { order } = data;
  return (
    <div className="page narrow">
      <div className="form-card success-box">
        <div className="tick">✅</div>
        <h2 className="page-title">Order Placed Successfully</h2>
        <p>Your payment was verified and your order has been saved.</p>
        <dl>
          <dt>Order ID</dt><dd>{order._id}</dd>
          <dt>Total</dt><dd>{formatPrice(order.totalAmount)}</dd>
          <dt>Payment</dt><dd>{order.paymentStatus}</dd>
          <dt>Status</dt><dd>{order.status}</dd>
        </dl>
        <div className="btn-row">
          <Link to="/orders" className="btn btn-primary">View My Orders</Link>
          <Link to="/products" className="btn btn-subtle">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
