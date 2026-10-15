import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchProducts, fetchWishlist } from '../services/api';
import useFetch from '../hooks/useFetch';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';

export default function Products() {
  // Filters live in the URL (?search=&category=&sort=) so refresh / back / sharing keep them.
  const [params, setParams] = useSearchParams();
  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || '';

  // The text box updates instantly; the URL (and therefore the API call) is debounced.
  const [searchInput, setSearchInput] = useState(search);

  const updateParam = useCallback(
    (key, value) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== search) updateParam('search', searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, updateParam]);

  const { data, loading, error, reload } = useFetch(`${search}|${category}|${sort}`, (signal) =>
    fetchProducts({ search, category, sort }, { signal })
  );
  const products = data?.products ?? [];

  // Which products are already saved? Loaded once from the backend; if it fails the
  // buttons simply start as "Add" (the server answers 409 if it was already saved).
  const wishlistFetch = useFetch('wishlist-ids', (signal) => fetchWishlist({ signal }));
  const savedIds = new Set((wishlistFetch.data?.wishlist ?? []).map((p) => p._id));
  const handleWishlistChange = (productId, saved) =>
    wishlistFetch.setData((d) => ({
      ...d,
      wishlist: saved
        ? [...d.wishlist, { _id: productId }]
        : d.wishlist.filter((p) => p._id !== productId)
    }));

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Products</h1>
        <p className="page-subtitle">Browse, search and filter the catalogue</p>
      </div>

      <SearchBar
        search={searchInput}
        category={category}
        sort={sort}
        onSearchChange={setSearchInput}
        onCategoryChange={(v) => updateParam('category', v)}
        onSortChange={(v) => updateParam('sort', v)}
      />

      {loading && <Loading message="Loading products..." />}
      {error && <ErrorState title="Something went wrong while loading products." onRetry={reload} />}
      {!loading && !error && products.length === 0 && (
        <EmptyState icon="🔍" title="No products found." message="Try a different search or category." />
      )}
      {!loading && !error && products.length > 0 && (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard
              key={p._id}
              product={p}
              wishlisted={savedIds.has(p._id)}
              onWishlistChange={handleWishlistChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
