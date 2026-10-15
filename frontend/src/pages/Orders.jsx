import { fetchOrders } from '../services/api';
import useFetch from '../hooks/useFetch';
import OrderCard from '../components/OrderCard';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';

export default function Orders() {
  const { data, loading, error, reload } = useFetch('orders', (signal) => fetchOrders({ signal }));

  if (loading) return <Loading message="Loading your orders..." />;
  if (error) return <ErrorState title="Unable to load your orders." onRetry={reload} />;

  if (data.orders.length === 0) {
    return (
      <EmptyState
        icon="📦"
        title="You have not placed any orders yet."
        actionLabel="Start Shopping"
        actionTo="/products"
      />
    );
  }

  return (
    <div className="page narrow">
      <h1 className="page-title">My Orders</h1>
      {data.orders.map((order) => (
        <OrderCard key={order._id} order={order} />
      ))}
    </div>
  );
}
