const crypto = require('crypto');
const Razorpay = require('razorpay');

/**
 * Razorpay client (Test Mode keys from the Razorpay dashboard).
 * The Key SECRET stays on the server: it is only used here and for signature checks.
 *
 * RAZORPAY_MOCK=1 swaps the network call for a stub. It exists ONLY so the automated
 * tests can run without real keys, and is ignored when NODE_ENV=production.
 * The HMAC signature verification is the same real code either way.
 */
const isMock = process.env.RAZORPAY_MOCK === '1' && process.env.NODE_ENV !== 'production';

const getKeyId = () => process.env.RAZORPAY_KEY_ID;
const getKeySecret = () => process.env.RAZORPAY_KEY_SECRET;
const isConfigured = () => Boolean(getKeyId() && getKeySecret());

let client;
const getClient = () => {
  if (isMock) {
    return {
      orders: {
        create: async ({ amount, currency, receipt }) => ({
          id: `order_mock_${crypto.randomBytes(8).toString('hex')}`,
          amount,
          currency,
          receipt
        })
      }
    };
  }
  if (!client) client = new Razorpay({ key_id: getKeyId(), key_secret: getKeySecret() });
  return client;
};

// Razorpay signs "<razorpay_order_id>|<razorpay_payment_id>" with HMAC-SHA256 using the key secret.
const computeSignature = (razorpayOrderId, razorpayPaymentId) =>
  crypto.createHmac('sha256', getKeySecret()).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');

// Constant-time comparison so response timing can't leak how much of a forged signature matched.
const isValidSignature = (razorpayOrderId, razorpayPaymentId, signature) => {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(computeSignature(razorpayOrderId, razorpayPaymentId), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

module.exports = { getClient, getKeyId, isConfigured, computeSignature, isValidSignature };
