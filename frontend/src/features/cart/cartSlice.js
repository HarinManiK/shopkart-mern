import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { addCartItem, fetchCart as fetchCartApi, getErrorMessage, removeCartItem, updateCartItem } from '../../services/api';

/*
 * Cart state - one shared copy for the Navbar, Product cards, Cart page and Checkout.
 *
 * The BACKEND is the source of truth. Every mutation thunk calls the API and the
 * server answers with the full, populated cart, which replaces `items`. We never
 * guess the new state locally, so the UI cannot drift from MongoDB.
 *
 * subtotal / item count are DERIVED (selectors below), never stored.
 */

const message = (err) => getErrorMessage(err, 'Could not update your cart');

export const fetchCart = createAsyncThunk('cart/fetch', async (_, { rejectWithValue }) => {
  try {
    return await fetchCartApi();
  } catch (err) {
    return rejectWithValue(message(err));
  }
});

export const addToCart = createAsyncThunk('cart/add', async (productId, { rejectWithValue }) => {
  try {
    return await addCartItem(productId);
  } catch (err) {
    return rejectWithValue(message(err));
  }
});

export const updateQuantity = createAsyncThunk(
  'cart/updateQuantity',
  async ({ productId, quantity }, { rejectWithValue }) => {
    try {
      return await updateCartItem(productId, quantity);
    } catch (err) {
      return rejectWithValue(message(err));
    }
  }
);

export const removeFromCart = createAsyncThunk('cart/remove', async (productId, { rejectWithValue }) => {
  try {
    return await removeCartItem(productId);
  } catch (err) {
    return rejectWithValue(message(err));
  }
});

const initialState = {
  items: [], // [{ product: {...}, quantity }]
  status: 'idle', // idle | loading | succeeded | failed  (for the initial/refresh load)
  error: null,
  pendingIds: [] // product ids with a mutation in flight -> per-item loading state
};

const argToProductId = (arg) => (typeof arg === 'string' ? arg : arg.productId);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    // Used on logout, and after a verified payment (the backend has emptied the cart).
    resetCart: () => initialState,
    clearCartItems: (state) => {
      state.items = [];
      state.status = 'succeeded';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Could not load your cart';
      });

    for (const thunk of [addToCart, updateQuantity, removeFromCart]) {
      builder
        .addCase(thunk.pending, (state, action) => {
          state.pendingIds.push(argToProductId(action.meta.arg));
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.items = action.payload;
          state.status = 'succeeded';
          state.pendingIds = state.pendingIds.filter((id) => id !== argToProductId(action.meta.arg));
        })
        .addCase(thunk.rejected, (state, action) => {
          state.pendingIds = state.pendingIds.filter((id) => id !== argToProductId(action.meta.arg));
        });
    }
  }
});

export const { resetCart, clearCartItems } = cartSlice.actions;
export default cartSlice.reducer;

// ---- Selectors (derived data) ----
export const selectCartItems = (state) => state.cart.items;
export const selectCartStatus = (state) => state.cart.status;
export const selectCartError = (state) => state.cart.error;
export const selectCartCount = (state) => state.cart.items.reduce((sum, row) => sum + row.quantity, 0);
export const selectCartSubtotal = (state) =>
  state.cart.items.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
export const selectQuantityInCart = (productId) => (state) =>
  state.cart.items.find((row) => row.product._id === productId)?.quantity ?? 0;
export const selectIsPending = (productId) => (state) => state.cart.pendingIds.includes(productId);
