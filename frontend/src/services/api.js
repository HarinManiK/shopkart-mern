import axios from 'axios';

// withCredentials makes the browser send/accept the HttpOnly "token" cookie.
// Requests go to the same origin (Vite proxies them to Express), so no base URL.
const api = axios.create({ withCredentials: true });

export const getErrorMessage = (err, fallback = 'Something went wrong') =>
  err.response?.data?.message || (err.request ? 'Cannot reach the server' : fallback);

// ---- Auth (Lab 1 backend) ----
export const registerCustomer = (data) => api.post('/customers/register', data).then((r) => r.data);
export const loginCustomer = (data) => api.post('/customers/login', data).then((r) => r.data);
export const logoutCustomer = () => api.post('/customers/logout').then((r) => r.data);
export const fetchMe = () => api.get('/customers/me').then((r) => r.data);
export const changePassword = (data) => api.patch('/customers/change-password', data).then((r) => r.data);

// ---- Products (Lab 3) ----
export const fetchProducts = (params = {}, config = {}) =>
  api.get('/products', { params, ...config }).then((r) => r.data);
export const fetchProduct = (id, config = {}) =>
  api.get(`/products/${id}`, config).then((r) => r.data);

// ---- Wishlist (Lab 4) ----
// Other parts of the UI (the navbar badge) listen for this event instead of
// sharing global state - the wishlist itself always lives in the backend.
export const WISHLIST_CHANGED = 'wishlist:changed';
const announceWishlistChange = (data) => {
  window.dispatchEvent(new Event(WISHLIST_CHANGED));
  return data;
};

export const fetchWishlist = (config = {}) => api.get('/wishlist', config).then((r) => r.data);
export const fetchWishlistCount = (config = {}) =>
  api.get('/wishlist/count', config).then((r) => r.data.count);
export const addToWishlist = (productId) =>
  api.post(`/wishlist/${productId}`).then((r) => announceWishlistChange(r.data));
export const removeFromWishlist = (productId) =>
  api.delete(`/wishlist/${productId}`).then((r) => announceWishlistChange(r.data));

// ---- Cart (Lab 5) ----
// Every mutation returns the full, populated cart so the client can replace its copy.
export const fetchCart = () => api.get('/cart').then((r) => r.data.cart);
export const addCartItem = (productId) => api.post(`/cart/${productId}`).then((r) => r.data.cart);
export const updateCartItem = (productId, quantity) =>
  api.patch(`/cart/${productId}`, { quantity }).then((r) => r.data.cart);
export const removeCartItem = (productId) => api.delete(`/cart/${productId}`).then((r) => r.data.cart);

// ---- Checkout & Orders (Lab 6) ----
export const createPaymentOrder = (shippingAddress) =>
  api.post('/orders/create-payment-order', { shippingAddress }).then((r) => r.data);
export const verifyPayment = (payload) => api.post('/orders/verify-payment', payload).then((r) => r.data);
export const fetchOrders = (config = {}) => api.get('/orders', config).then((r) => r.data);
export const fetchOrder = (id, config = {}) => api.get(`/orders/${id}`, config).then((r) => r.data);
// Bonus (development only on the backend): move an order to its next status.
export const advanceOrderStatus = (id) => api.patch(`/orders/${id}/status`).then((r) => r.data);

export default api;
