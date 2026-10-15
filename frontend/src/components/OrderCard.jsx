import { Link } from 'react-router-dom';
import { formatDate, formatPrice } from '../utils/format';

export default function OrderCard({ order }) {
  return (
    <article className="form-card order-card">
      <div className="order-head">
        <div>
          <h4>Order #{order._id.slice(-8)}</h4>
          <span className="page-subtitle">{formatDate(order.createdAt)}</span>
        </div>
        <span className={`status-pill ${order.status}`}>{order.status.replace('_', ' ')}</span>
      </div>
      <ul className="order-items">
        {order.items.map((item) => (
          <li key={item.product}>{item.name} × {item.quantity}</li>
        ))}
      </ul>
      <div className="summary-row total">
        <span>Total</span>
        <span>{formatPrice(order.totalAmount)}</span>
      </div>
      <div>
        <Link to={`/orders/${order._id}`} className="btn btn-subtle">View Details</Link>
      </div>
    </article>
  );
}
