import { fetchWishlist } from '../services/api';
import useFetch from '../hooks/useFetch';
import WishlistCard from '../components/WishlistCard';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';

export default function Wishlist() {
  const { data, loading, error, reload, setData } = useFetch('wishlist', (signal) => fetchWishlist({ signal }));

  const handleRemoved = (productId) =>
    setData((d) => {
      const wishlist = d.wishlist.filter((p) => p._id !== productId);
      return { ...d, wishlist, count: wishlist.length };
    });

  if (loading) return <Loading message="Loading your wishlist..." />;
  if (error) {
    return (
      <ErrorState
        title="Something went wrong."
        message="We couldn't load your wishlist."
        onRetry={reload}
      />
    );
  }

  const items = data.wishlist;
  if (items.length === 0) {
    return (
      <EmptyState
        icon="❤️"
        title="Your wishlist is empty"
        message="Save products you love and find them here later."
        actionLabel="Browse Products"
        actionTo="/products"
      />
    );
  }

  return (
    <div className="page">
      <div>
        <h1 className="page-title">My Wishlist</h1>
        <p className="page-subtitle">
          {items.length} {items.length === 1 ? 'product' : 'products'} saved
        </p>
      </div>
      <div className="product-grid">
        {items.map((p) => (
          <WishlistCard key={p._id} product={p} onRemoved={handleRemoved} />
        ))}
      </div>
    </div>
  );
}
