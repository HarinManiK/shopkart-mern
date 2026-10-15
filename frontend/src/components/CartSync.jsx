import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../context/AuthContext';
import { fetchCart, resetCart } from '../features/cart/cartSlice';

// Keeps the cart store in step with the session: load the cart when someone
// is logged in, wipe it when they log out (so Cart (n) never leaks between users).
export default function CartSync() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const userId = user?._id;

  useEffect(() => {
    if (userId) dispatch(fetchCart());
    else dispatch(resetCart());
  }, [userId, dispatch]);

  return null;
}
