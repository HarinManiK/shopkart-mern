import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Frontend page routes (/products, /cart, /orders, /wishlist) share their names
// with backend API routes. A browser page load sends "Accept: text/html", so we
// serve index.html for those and only proxy real API (axios/JSON) calls.
const apiProxy = {
  target: 'http://localhost:5000',
  changeOrigin: true,
  bypass: (req) => (req.headers.accept?.includes('text/html') ? '/index.html' : undefined)
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/customers': apiProxy,
      '/products': apiProxy,
      '/wishlist': apiProxy,
      '/cart': apiProxy,
      '/orders': apiProxy
    }
  }
});
