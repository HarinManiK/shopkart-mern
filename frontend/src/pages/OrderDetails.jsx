import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { advanceOrderStatus, fetchOrder, getErrorMessage } from '../services/api';
import useFetch from '../hooks/useFetch';
import ProductImage from '../components/ProductImage';
import { ErrorState, Loading } from '../components/StateViews';
import { formatDate, formatPrice } from '../utils/format';

const STEPS = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];

export default function OrderDetails() {
  const { id } = useParams();
  const { data, loading, error, reload, setData } = useFetch(id, (signal) => fetchOrder(id, { signal }));
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState('');

  if (loading) return <Loading message="Loading order..." />;
  if (error) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return (
        <div className="state-box">
          <h3>Order not found</h3>
          <Link to="/orders" className="btn btn-primary">Back to My Orders</Link>
        </div>
      );
    }
    return <ErrorState title="Unable to load this order." onRetry={reload} />;
  }

  const { order } = data;
  const stepIndex = STEPS.indexOf(order.status);
  const address = order.shippingAddress;

  // Development-only helper for the "order status" bonus (the backend disables it in production).
  const handleAdvance = async () => {
    setAdvancing(true);
    setAdvanceError('');
    try {
      const result = await advanceOrderStatus(order._id);
      setData((d) => ({ ...d, order: result.order }));
    } catch (err) {
      setAdvanceError(getErrorMessage(err));
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="page narrow">
      <Link to="/orders">← Back to my orders</Link>
      <div className="form-card order-card">
        <div className="order-head">
          <div>
            <h4>Order {order._id}</h4>
            <span className="page-subtitle">Placed on {formatDate(order.createdAt)}</span>
          </div>
          <span className={`status-pill ${order.paymentStatus}`}>Payment: {order.paymentStatus}</span>
        </div>

        {stepIndex >= 0 && (
          <div className="progress" aria-label="Order progress">
            {STEPS.map((step, i) => (
              <span key={step} className={`step ${i <= stepIndex ? 'done' : ''}`}>{step}</span>
            ))}
          </div>
        )}

        <div>
          {order.items.map((item) => (
            <div className="cart-item" key={item.product}>
              <div className="thumb"><ProductImage src={item.image} alt={item.name} /></div>
              <div>
                <h4>{item.name}</h4>
                <span className="unit-price">{formatPrice(item.price)} × {item.quantity}</span>
              </div>
              <div className="line-total">{formatPrice(item.price * item.quantity)}</div>
            </div>
          ))}
        </div>
        <div className="summary-row total"><span>Total</span><span>{formatPrice(order.totalAmount)}</span></div>
      </div>

      <div className="form-card">
        <div className="card-title-row"><h3>Delivering to</h3></div>
        <p>{address.fullName} · {address.phone}</p>
        <p>{address.addressLine1}, {address.city}, {address.state} - {address.pincode}</p>
        {order.razorpayPaymentId && <p className="hint">Payment ID: {order.razorpayPaymentId}</p>}
      </div>

      {import.meta.env.DEV && stepIndex >= 0 && stepIndex < STEPS.length - 1 && (
        <div>
          <button type="button" className="btn btn-subtle" onClick={handleAdvance} disabled={advancing}>
            {advancing ? 'Updating...' : `Dev: move to ${STEPS[stepIndex + 1]}`}
          </button>
          {advanceError && <span className="inline-error"> {advanceError}</span>}
        </div>
      )}
    </div>
  );
}
