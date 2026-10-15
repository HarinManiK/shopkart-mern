/**
 * Lab 06 tests. This file starts its OWN backend on a separate port with a mock
 * Razorpay gateway (RAZORPAY_MOCK=1) and a known secret, so it needs no real keys.
 * Only the outbound call to Razorpay is stubbed - signature verification, totals,
 * stock checks and cart clearing all run the real code.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');

const PORT = 5099;
const SECRET = 'mock_secret_for_tests';
const KEY_ID = 'rzp_test_mockkey';
process.env.TEST_BASE_URL = `http://127.0.0.1:${PORT}`; // must be set before requiring helpers

const { createClient, registerAndLogin, createTestProduct, cleanup, MONGO_URI } = require('./helpers');

const ADDRESS = {
  fullName: 'Aarav Sharma',
  phone: '9876543210',
  addressLine1: '22 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001'
};
const UNKNOWN_ID = '64b64b64b64b64b64b64b64b';

let server;
const sign = (orderId, paymentId, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

const paymentId = () => `pay_${crypto.randomBytes(6).toString('hex')}`;
const productsCol = () => mongoose.connection.db.collection('products');
const ordersCol = () => mongoose.connection.db.collection('orders');
const stockOf = async (id) => (await productsCol().findOne({ _id: new mongoose.Types.ObjectId(id) })).stock;

test.before(async () => {
  server = spawn('node', ['index.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
      RAZORPAY_MOCK: '1',
      RAZORPAY_KEY_ID: KEY_ID,
      RAZORPAY_KEY_SECRET: SECRET
    },
    stdio: 'ignore'
  });
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  await mongoose.connect(MONGO_URI);
});

test.after(async () => {
  await mongoose.disconnect();
  server.kill();
  await cleanup();
});

// A logged-in customer with `qty` of a fresh product in their cart.
const shopperWithCart = async (label, productOverrides = {}, qty = 1) => {
  const who = await registerAndLogin(label);
  const product = await createTestProduct(who.client, { name: `Order ${label}`, price: 999, stock: 10, ...productOverrides });
  for (let i = 0; i < qty; i += 1) await who.client.post(`/cart/${product._id}`);
  return { ...who, product };
};

const startCheckout = (client, body = { shippingAddress: ADDRESS }) =>
  client.post('/orders/create-payment-order', body);

const payFor = async (client, checkout, overrides = {}) => {
  const pid = paymentId();
  return client.post('/orders/verify-payment', {
    shopKartOrderId: checkout.shopKartOrderId,
    razorpay_order_id: checkout.razorpayOrderId,
    razorpay_payment_id: pid,
    razorpay_signature: sign(checkout.razorpayOrderId, pid),
    ...overrides
  });
};

test('all order endpoints require authentication (401)', async () => {
  const anon = createClient();
  assert.equal((await anon.post('/orders/create-payment-order', { shippingAddress: ADDRESS })).status, 401);
  assert.equal((await anon.post('/orders/verify-payment', {})).status, 401);
  assert.equal((await anon.get('/orders')).status, 401);
  assert.equal((await anon.get(`/orders/${UNKNOWN_ID}`)).status, 401);
});

test('empty cart is rejected (400)', async () => {
  const { client } = await registerAndLogin('emptycart');
  const res = await startCheckout(client);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /empty/i);
});

test('invalid shipping details are rejected (400)', async () => {
  const { client } = await shopperWithCart('badaddr');
  const bad = [
    undefined,
    {},
    { ...ADDRESS, fullName: '   ' },
    { ...ADDRESS, addressLine1: '' },
    { ...ADDRESS, city: undefined },
    { ...ADDRESS, state: '  ' },
    { ...ADDRESS, phone: '12345' },
    { ...ADDRESS, phone: 'abcdefghij' },
    { ...ADDRESS, pincode: '12345' },
    { ...ADDRESS, pincode: '12ab56' }
  ];
  for (const shippingAddress of bad) {
    const res = await startCheckout(client, shippingAddress === undefined ? {} : { shippingAddress });
    assert.equal(res.status, 400, JSON.stringify(shippingAddress));
  }
});

test('create-payment-order: server-side total in paise, safe response, cart untouched', async () => {
  const { client, product } = await shopperWithCart('create', { price: 2999.5 }, 2);
  // The client "sends" fake money values - they must all be ignored.
  const res = await startCheckout(client, {
    shippingAddress: ADDRESS,
    totalAmount: 1,
    amount: 1,
    items: [{ price: 1, quantity: 1 }]
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.amount, Math.round(2999.5 * 2 * 100));
  assert.equal(res.body.currency, 'INR');
  assert.equal(res.body.key, KEY_ID);
  assert.ok(res.body.razorpayOrderId);
  assert.ok(res.body.shopKartOrderId);
  assert.ok(!JSON.stringify(res.body).includes(SECRET), 'key secret must never be returned');

  const stored = await ordersCol().findOne({ _id: new mongoose.Types.ObjectId(res.body.shopKartOrderId) });
  assert.equal(stored.paymentStatus, 'PENDING');
  assert.equal(stored.status, 'PENDING_PAYMENT');
  assert.equal(stored.totalAmount, 5999);
  assert.equal(stored.items[0].name, product.name); // snapshot
  assert.equal(stored.razorpayOrderId, res.body.razorpayOrderId);

  const cart = (await client.get('/cart')).body.cart;
  assert.equal(cart.length, 1, 'cart must not be cleared before payment');
  assert.equal(cart[0].quantity, 2);
  assert.equal((await client.get('/orders')).body.count, 0, 'unpaid orders are not order history');
});

test('stock is re-checked at checkout (insufficient / out of stock / deleted product)', async () => {
  const a = await shopperWithCart('lowstock', { stock: 5 }, 3);
  await productsCol().updateOne({ _id: new mongoose.Types.ObjectId(a.product._id) }, { $set: { stock: 2 } });
  const low = await startCheckout(a.client);
  assert.equal(low.status, 400);
  assert.match(low.body.message, /Insufficient stock for/);
  assert.match(low.body.message, new RegExp(a.product.name));

  await productsCol().updateOne({ _id: new mongoose.Types.ObjectId(a.product._id) }, { $set: { stock: 0 } });
  assert.equal((await startCheckout(a.client)).status, 400);

  const b = await shopperWithCart('gone');
  await productsCol().deleteOne({ _id: new mongoose.Types.ObjectId(b.product._id) });
  const gone = await startCheckout(b.client);
  assert.equal(gone.status, 400);
  assert.equal((await b.client.get('/cart')).status, 200);
});

test('verify-payment with a FAKE signature fails: order stays unpaid, cart and stock untouched', async () => {
  const { client, product } = await shopperWithCart('fakesig', { stock: 10 }, 2);
  const checkout = (await startCheckout(client)).body;
  const pid = paymentId();

  const forged = [
    'f'.repeat(64),
    'not-hex',
    sign(checkout.razorpayOrderId, pid, 'wrong_secret'),
    sign('order_other', pid)
  ];
  for (const razorpay_signature of forged) {
    const res = await client.post('/orders/verify-payment', {
      shopKartOrderId: checkout.shopKartOrderId,
      razorpay_order_id: checkout.razorpayOrderId,
      razorpay_payment_id: pid,
      razorpay_signature
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Invalid payment signature/);
  }

  const stored = await ordersCol().findOne({ _id: new mongoose.Types.ObjectId(checkout.shopKartOrderId) });
  assert.equal(stored.paymentStatus, 'PENDING');
  assert.equal(stored.razorpayPaymentId, undefined);
  assert.equal((await client.get('/cart')).body.cart[0].quantity, 2);
  assert.equal(await stockOf(product._id), 10);
});

test('verify-payment rejects missing fields, bad ids and a browser order id that differs from ours', async () => {
  const { client } = await shopperWithCart('verifybad');
  const checkout = (await startCheckout(client)).body;
  const pid = paymentId();

  assert.equal((await client.post('/orders/verify-payment', {})).status, 400);
  assert.equal(
    (await client.post('/orders/verify-payment', { shopKartOrderId: 'nope', razorpay_order_id: 'x', razorpay_payment_id: 'y', razorpay_signature: 'z' })).status,
    400
  );
  assert.equal(
    (await client.post('/orders/verify-payment', { shopKartOrderId: UNKNOWN_ID, razorpay_order_id: 'x', razorpay_payment_id: 'y', razorpay_signature: 'z' })).status,
    404
  );
  // Correctly signed, but for a different Razorpay order than the one we stored.
  const res = await client.post('/orders/verify-payment', {
    shopKartOrderId: checkout.shopKartOrderId,
    razorpay_order_id: 'order_someone_else',
    razorpay_payment_id: pid,
    razorpay_signature: sign('order_someone_else', pid)
  });
  assert.equal(res.status, 400);
});

test('valid payment: PAID + PLACED, payment id stored, cart cleared, stock reduced, history updated', async () => {
  const { client, product } = await shopperWithCart('happy', { price: 1500, stock: 10 }, 3);
  const checkout = (await startCheckout(client)).body;
  const pid = paymentId();
  const res = await client.post('/orders/verify-payment', {
    shopKartOrderId: checkout.shopKartOrderId,
    razorpay_order_id: checkout.razorpayOrderId,
    razorpay_payment_id: pid,
    razorpay_signature: sign(checkout.razorpayOrderId, pid)
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.order.paymentStatus, 'PAID');
  assert.equal(res.body.order.status, 'PLACED');
  assert.equal(res.body.order.razorpayPaymentId, pid);
  assert.equal(res.body.order.totalAmount, 4500);

  assert.deepEqual((await client.get('/cart')).body.cart, [], 'cart cleared after verified payment');
  assert.equal(await stockOf(product._id), 7, 'stock decremented');

  const list = await client.get('/orders');
  assert.equal(list.body.count, 1);
  assert.equal(list.body.orders[0]._id, checkout.shopKartOrderId);
  const single = await client.get(`/orders/${checkout.shopKartOrderId}`);
  assert.equal(single.status, 200);
  assert.equal(single.body.order.items[0].quantity, 3);
});

test('order keeps the purchase-time price/name even if the product changes later', async () => {
  const { client, product } = await shopperWithCart('snapshot', { price: 2999 });
  const checkout = (await startCheckout(client)).body;
  await payFor(client, checkout);

  await productsCol().updateOne(
    { _id: new mongoose.Types.ObjectId(product._id) },
    { $set: { price: 3499, name: 'TEST-Renamed Later' } }
  );
  const order = (await client.get(`/orders/${checkout.shopKartOrderId}`)).body.order;
  assert.equal(order.items[0].price, 2999);
  assert.equal(order.items[0].name, product.name);
  assert.equal(order.totalAmount, 2999);
});

test('verifying twice (or in parallel) is safe: stock is reduced exactly once', async () => {
  const { client, product } = await shopperWithCart('idem', { stock: 10 }, 2);
  const checkout = (await startCheckout(client)).body;
  const pid = paymentId();
  const body = {
    shopKartOrderId: checkout.shopKartOrderId,
    razorpay_order_id: checkout.razorpayOrderId,
    razorpay_payment_id: pid,
    razorpay_signature: sign(checkout.razorpayOrderId, pid)
  };
  const results = await Promise.all(Array.from({ length: 5 }, () => client.post('/orders/verify-payment', body)));
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(await stockOf(product._id), 8);
  assert.equal((await client.get('/orders')).body.count, 1);
});

test('a new checkout supersedes the previous unpaid attempt', async () => {
  const { client } = await shopperWithCart('retry');
  const first = (await startCheckout(client)).body;
  const second = (await startCheckout(client)).body;
  assert.notEqual(first.razorpayOrderId, second.razorpayOrderId);

  const pid = paymentId();
  const stale = await client.post('/orders/verify-payment', {
    shopKartOrderId: first.shopKartOrderId,
    razorpay_order_id: first.razorpayOrderId,
    razorpay_payment_id: pid,
    razorpay_signature: sign(first.razorpayOrderId, pid)
  });
  assert.equal(stale.status, 400);
  assert.equal((await payFor(client, second)).status, 200);
});

test("a customer can't read or verify someone else's order (404)", async () => {
  const owner = await shopperWithCart('owner');
  const intruder = await registerAndLogin('intruder');
  const checkout = (await startCheckout(owner.client)).body;
  await payFor(owner.client, checkout);

  assert.equal((await intruder.client.get(`/orders/${checkout.shopKartOrderId}`)).status, 404);
  assert.equal((await intruder.client.get('/orders')).body.count, 0);
  const pid = paymentId();
  const steal = await intruder.client.post('/orders/verify-payment', {
    shopKartOrderId: checkout.shopKartOrderId,
    razorpay_order_id: checkout.razorpayOrderId,
    razorpay_payment_id: pid,
    razorpay_signature: sign(checkout.razorpayOrderId, pid)
  });
  assert.equal(steal.status, 404);
});

test('orders list is newest first; GET /orders/:id validates the id', async () => {
  const { client, product } = await shopperWithCart('history');
  const first = (await startCheckout(client)).body;
  await payFor(client, first);
  await new Promise((r) => setTimeout(r, 20));
  await client.post(`/cart/${product._id}`);
  const second = (await startCheckout(client)).body;
  await payFor(client, second);

  const ids = (await client.get('/orders')).body.orders.map((o) => o._id);
  assert.deepEqual(ids, [second.shopKartOrderId, first.shopKartOrderId]);
  assert.equal((await client.get('/orders/nope')).status, 400);
  assert.equal((await client.get(`/orders/${UNKNOWN_ID}`)).status, 404);
});

test('bonus: order status advances PLACED -> CONFIRMED -> SHIPPED -> DELIVERED', async () => {
  const { client } = await shopperWithCart('status');
  const checkout = (await startCheckout(client)).body;
  await payFor(client, checkout);
  const seen = [];
  for (let i = 0; i < 3; i += 1) seen.push((await client.patch(`/orders/${checkout.shopKartOrderId}/status`)).body.order.status);
  assert.deepEqual(seen, ['CONFIRMED', 'SHIPPED', 'DELIVERED']);
  assert.equal((await client.patch(`/orders/${checkout.shopKartOrderId}/status`)).status, 400);
});
