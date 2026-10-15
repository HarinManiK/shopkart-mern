const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

// Loads Razorpay's Checkout script once. Resolves false (never throws) if it can't load.
export const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

/**
 * Opens Razorpay Checkout and returns a promise:
 *  - resolves with { razorpay_order_id, razorpay_payment_id, razorpay_signature } on success
 *  - rejects with { dismissed: true } if the customer closes the popup
 *
 * A failed attempt (e.g. wrong test card) does NOT settle the promise: Razorpay keeps the
 * popup open so the customer can retry, and a later success must still be handled.
 * `onPaymentFailed(message)` lets the caller show the failure meanwhile.
 *
 * IMPORTANT: resolving here only means "the browser says it paid". The caller must send
 * these values to our backend, which verifies the HMAC signature before trusting anything.
 */
export const openRazorpayCheckout = ({ onPaymentFailed, ...options }) =>
  new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      ...options,
      handler: resolve,
      modal: { ondismiss: () => reject({ dismissed: true }) }
    });
    checkout.on('payment.failed', (response) => {
      onPaymentFailed?.(response?.error?.description || 'Payment failed');
    });
    checkout.open();
  });
