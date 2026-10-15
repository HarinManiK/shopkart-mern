import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../context/AuthContext';
import { clearCartItems, fetchCart, selectCartError, selectCartItems, selectCartStatus } from '../features/cart/cartSlice';
import { createPaymentOrder, getErrorMessage, verifyPayment } from '../services/api';
import { loadRazorpayScript, openRazorpayCheckout } from '../utils/razorpay';
import { validateShipping } from '../utils/validation';
import CheckoutForm from '../components/CheckoutForm';
import OrderSummary from '../components/OrderSummary';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';

const STAGE_LABEL = {
  creating: 'Creating your order...',
  paying: 'Waiting for payment...',
  verifying: 'Verifying payment...'
};

export default function Checkout() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector(selectCartItems);
  const cartStatus = useSelector(selectCartStatus);
  const cartError = useSelector(selectCartError);

  const [values, setValues] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState(null); // null | creating | paying | verifying
  const [notice, setNotice] = useState(null); // { type: 'error' | 'success', text }

  if (cartStatus === 'idle' || (cartStatus === 'loading' && items.length === 0)) {
    return <Loading message="Loading your cart..." />;
  }
  if (cartStatus === 'failed') {
    return <ErrorState title="Unable to load your cart." message={cartError} onRetry={() => dispatch(fetchCart())} />;
  }
  // Opening /checkout directly with nothing in the cart.
  if (items.length === 0) {
    return (
      <EmptyState
        icon="🛒"
        title="Your cart is empty"
        message="Add something to your cart before checking out."
        actionLabel="Browse Products"
        actionTo="/products"
      />
    );
  }

  const busy = stage !== null;

  const handleChange = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: undefined });
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setNotice(null);

    const found = validateShipping(values);
    setErrors(found);
    if (Object.keys(found).length) return; // no backend call if basic validation fails

    const address = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    let checkout;

    try {
      // 1) Server validates cart + stock, calculates the total, creates the pending order
      //    and the Razorpay order. We send ONLY the address - never prices or totals.
      setStage('creating');
      checkout = await createPaymentOrder(address);
    } catch (err) {
      setNotice({ type: 'error', text: getErrorMessage(err, 'Could not place your order') });
      dispatch(fetchCart()); // stock/prices may have changed - show the latest cart
      setStage(null);
      return;
    }

    let paymentResponse;
    let declined = false; // true once Razorpay reported a failed attempt
    try {
      // 2) Razorpay Checkout (test mode)
      if (!(await loadRazorpayScript())) {
        throw new Error('script');
      }
      setStage('paying');
      paymentResponse = await openRazorpayCheckout({
        key: checkout.key,
        amount: checkout.amount,
        currency: checkout.currency,
        name: 'ShopKart',
        description: 'ShopKart Order',
        order_id: checkout.razorpayOrderId,
        prefill: { name: address.fullName, contact: address.phone, email: user?.email },
        theme: { color: '#1d4ed8' },
        onPaymentFailed: (message) => {
          declined = true;
          setNotice({ type: 'error', text: `Payment failed (${message}). Your cart has not been cleared. Please try again.` });
        }
      });
    } catch (err) {
      if (err?.dismissed) {
        // Closing the popup after a decline should keep showing the decline reason.
        if (!declined) setNotice({ type: 'error', text: 'Payment was cancelled. Your cart has not been cleared.' });
      } else {
        setNotice({
          type: 'error',
          text: 'Could not load the payment gateway. Check your connection and try again. Your cart has not been cleared.'
        });
      }
      setStage(null);
      return;
    }

    try {
      // 3) The browser's "success" is not proof of payment: the backend checks Razorpay's signature.
      setStage('verifying');
      const result = await verifyPayment({
        shopKartOrderId: checkout.shopKartOrderId,
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature
      });
      // 4) Backend has emptied the cart; mirror that in the shared state so the navbar shows Cart (0).
      dispatch(clearCartItems());
      navigate(`/order-success/${result.order._id}`, { replace: true });
    } catch (err) {
      setNotice({
        type: 'error',
        text: `${getErrorMessage(err, 'We could not confirm your payment.')} Your cart has not been cleared. If money was deducted, check My Orders or contact support.`
      });
      setStage(null);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">Checkout</h1>
      <form className="cart-layout" onSubmit={handlePlaceOrder} noValidate>
        <div className="form-card">
          <div className="card-title-row"><h3>Shipping Details</h3></div>
          {notice && <div className={`alert-box ${notice.type}`} role="alert">{notice.text}</div>}
          <CheckoutForm values={values} errors={errors} onChange={handleChange} disabled={busy} />
        </div>
        <OrderSummary items={items} showLines>
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy}>
            {busy ? STAGE_LABEL[stage] : 'Place Order'}
          </button>
          <p className="hint">Payments run in Razorpay Test Mode. No real money is charged.</p>
        </OrderSummary>
      </form>
    </div>
  );
}
