import { formatPrice } from '../utils/format';

// Presentational summary used by both the Cart and Checkout pages.
// Everything is derived from `items` - nothing is stored.
export default function OrderSummary({ items, showLines = false, children }) {
  const units = items.reduce((sum, row) => sum + row.quantity, 0);
  const total = items.reduce((sum, row) => sum + row.product.price * row.quantity, 0);

  return (
    <aside className="form-card sticky-card">
      <div className="card-title-row"><h3>Order Summary</h3></div>
      {showLines &&
        items.map((row) => (
          <div className="summary-row" key={row.product._id}>
            <span>{row.product.name} × {row.quantity}</span>
            <span>{formatPrice(row.product.price * row.quantity)}</span>
          </div>
        ))}
      {!showLines && <div className="summary-row"><span>Items</span><span>{units}</span></div>}
      <div className="summary-row total">
        <span>{showLines ? 'Total' : 'Subtotal'}</span>
        <span>{formatPrice(total)}</span>
      </div>
      {children}
    </aside>
  );
}
