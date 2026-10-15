import { useEffect, useState } from 'react';
import { fetchWishlistCount, WISHLIST_CHANGED } from '../services/api';

// Navbar badge: always read from the backend, refreshed whenever the wishlist changes.
export default function useWishlistCount(enabled) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const load = () =>
      fetchWishlistCount()
        .then((n) => active && setCount(n))
        .catch(() => {});
    load();
    window.addEventListener(WISHLIST_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener(WISHLIST_CHANGED, load);
    };
  }, [enabled]);

  return enabled ? count : 0;
}
