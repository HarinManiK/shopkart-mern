import { useState } from 'react';
import { addToWishlist, getErrorMessage, removeFromWishlist } from '../services/api';

/**
 * Heart button used on product cards.
 * States: idle -> saving -> saved (and back). Never silently fails.
 * `saved` comes from the parent (the backend is the source of truth).
 */
export default function WishlistButton({ productId, saved, onChange }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState(false);

  const handleClick = async () => {
    if (saving) return; // no duplicate requests while one is in flight
    setSaving(true);
    setError('');
    setJustAdded(false);
    try {
      if (saved) {
        await removeFromWishlist(productId);
        onChange(false);
      } else {
        await addToWishlist(productId);
        onChange(true);
        setJustAdded(true);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        onChange(true); // already saved on the server - just sync the UI
      } else if (err.response?.status === 404 && saved) {
        onChange(false); // already gone on the server
      } else {
        setError(
          err.response?.status === 401
            ? 'Please log in again.'
            : `Unable to ${saved ? 'remove' : 'save'} product. ${getErrorMessage(err, 'Please try again.')}`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  let label = '♡ Add to Wishlist';
  if (saving) label = '⏳ Saving...';
  else if (saved) label = '♥ Remove from Wishlist';

  return (
    <>
      <button
        type="button"
        className={`btn wishlist-btn ${saved ? 'saved' : ''}`}
        onClick={handleClick}
        disabled={saving}
        aria-pressed={saved}
      >
        {label}
      </button>
      {justAdded && !error && <span className="inline-success">♥ Added to Wishlist</span>}
      {error && <span className="inline-error" role="alert">{error}</span>}
    </>
  );
}
