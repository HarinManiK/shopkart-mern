const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createClient, registerAndLogin, createTestProduct, cleanup, MONGO_URI } = require('./helpers');

const UNKNOWN_ID = '64b64b64b64b64b64b64b64b';

test.after(cleanup);

const qtyOf = (cart, productId) => cart.find((row) => row.product._id === productId)?.quantity;

test('all cart endpoints require authentication (401)', async () => {
  const anon = createClient();
  assert.equal((await anon.get('/cart')).status, 401);
  assert.equal((await anon.post(`/cart/${UNKNOWN_ID}`)).status, 401);
  assert.equal((await anon.patch(`/cart/${UNKNOWN_ID}`, { quantity: 1 })).status, 401);
  assert.equal((await anon.delete(`/cart/${UNKNOWN_ID}`)).status, 401);
});

test('new customers start with an empty cart', async () => {
  const { client } = await registerAndLogin('cartempty');
  const res = await client.get('/cart');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.cart, []);
});

test('add new item (qty 1) then add again (qty 2, still ONE row)', async () => {
  const { client } = await registerAndLogin('cartadd');
  const p = await createTestProduct(client, { name: 'Cart Item', price: 300, stock: 10 });

  const first = await client.post(`/cart/${p._id}`);
  assert.equal(first.status, 200);
  assert.equal(first.body.cart.length, 1);
  assert.equal(qtyOf(first.body.cart, p._id), 1);

  const second = await client.post(`/cart/${p._id}`);
  assert.equal(second.body.cart.length, 1, 'no duplicate rows');
  assert.equal(qtyOf(second.body.cart, p._id), 2);
});

test('GET /cart returns populated product data + quantity', async () => {
  const { client } = await registerAndLogin('cartget');
  const p = await createTestProduct(client, { name: 'Populated', price: 450, stock: 5 });
  await client.post(`/cart/${p._id}`);
  const res = await client.get('/cart');
  const row = res.body.cart[0];
  assert.equal(row.quantity, 1);
  assert.equal(row.product.name, p.name);
  assert.equal(row.product.price, 450);
  assert.equal(row.product.stock, 5);
  assert.ok(row.product.image);
});

test('PATCH updates quantity and enforces 1 <= qty <= stock', async () => {
  const { client } = await registerAndLogin('cartpatch');
  const p = await createTestProduct(client, { name: 'Patch Item', stock: 4 });
  await client.post(`/cart/${p._id}`);

  const ok = await client.patch(`/cart/${p._id}`, { quantity: 3 });
  assert.equal(ok.status, 200);
  assert.equal(qtyOf(ok.body.cart, p._id), 3);

  for (const bad of [0, -2, 1.5, '2', null, undefined]) {
    const res = await client.patch(`/cart/${p._id}`, bad === undefined ? {} : { quantity: bad });
    assert.equal(res.status, 400, `quantity=${JSON.stringify(bad)}`);
  }
  assert.equal((await client.patch(`/cart/${p._id}`, { quantity: 5 })).status, 400, 'above stock');
  assert.equal((await client.patch(`/cart/${p._id}`, { quantity: 4 })).status, 200, 'exactly stock is fine');
});

test('PATCH error cases: bad id 400, unknown product 404, not in cart 404', async () => {
  const { client } = await registerAndLogin('cartpatcherr');
  const p = await createTestProduct(client, { name: 'Not In Cart' });
  assert.equal((await client.patch('/cart/nope', { quantity: 1 })).status, 400);
  assert.equal((await client.patch(`/cart/${UNKNOWN_ID}`, { quantity: 1 })).status, 404);
  assert.equal((await client.patch(`/cart/${p._id}`, { quantity: 1 })).status, 404);
});

test('adding beyond stock is rejected (400) and out-of-stock cannot be added', async () => {
  const { client } = await registerAndLogin('cartstock');
  const p = await createTestProduct(client, { name: 'Scarce', stock: 2 });
  assert.equal((await client.post(`/cart/${p._id}`)).status, 200);
  assert.equal((await client.post(`/cart/${p._id}`)).status, 200);
  const over = await client.post(`/cart/${p._id}`);
  assert.equal(over.status, 400);
  assert.match(over.body.message, /Only 2/);
  assert.equal(qtyOf((await client.get('/cart')).body.cart, p._id), 2);

  const none = await createTestProduct(client, { name: 'Sold Out', stock: 0 });
  assert.equal((await client.post(`/cart/${none._id}`)).status, 400);
});

test('concurrent adds can never exceed stock', async () => {
  const { client } = await registerAndLogin('cartrace');
  const p = await createTestProduct(client, { name: 'Race Cart', stock: 3 });
  const results = await Promise.all(Array.from({ length: 12 }, () => client.post(`/cart/${p._id}`)));
  assert.equal(results.filter((r) => r.status === 200).length, 3);
  assert.equal(results.filter((r) => r.status === 400).length, 9);
  const cart = (await client.get('/cart')).body.cart;
  assert.equal(cart.length, 1);
  assert.equal(qtyOf(cart, p._id), 3);
});

test('DELETE removes the row and returns the updated cart; 404 if absent; 400 for bad id', async () => {
  const { client } = await registerAndLogin('cartdel');
  const a = await createTestProduct(client, { name: 'Del A' });
  const b = await createTestProduct(client, { name: 'Del B' });
  await client.post(`/cart/${a._id}`);
  await client.post(`/cart/${b._id}`);

  const del = await client.delete(`/cart/${a._id}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.cart.length, 1);
  assert.equal(del.body.cart[0].product._id, b._id);
  assert.equal((await client.delete(`/cart/${a._id}`)).status, 404);
  assert.equal((await client.delete('/cart/nope')).status, 400);
});

test('POST unknown product -> 404, invalid id -> 400', async () => {
  const { client } = await registerAndLogin('cart404');
  assert.equal((await client.post(`/cart/${UNKNOWN_ID}`)).status, 404);
  assert.equal((await client.post('/cart/nope')).status, 400);
});

test('carts are private and persist across logins', async () => {
  const a = await registerAndLogin('cartA');
  const b = await registerAndLogin('cartB');
  const p = await createTestProduct(a.client, { name: 'Shared Product' });
  await a.client.post(`/cart/${p._id}`);
  assert.deepEqual((await b.client.get('/cart')).body.cart, []);

  const fresh = createClient();
  await fresh.post('/customers/login', { email: a.email, password: a.password });
  assert.equal(qtyOf((await fresh.get('/cart')).body.cart, p._id), 1);
});

test('cart always shows the LATEST product price and stock', async () => {
  const { client } = await registerAndLogin('cartlive');
  const p = await createTestProduct(client, { name: 'Price Change', price: 100, stock: 10 });
  await client.post(`/cart/${p._id}`);

  await mongoose.connect(MONGO_URI);
  await mongoose.connection.db
    .collection('products')
    .updateOne({ _id: new mongoose.Types.ObjectId(p._id) }, { $set: { price: 175, stock: 1 } });
  await mongoose.disconnect();

  const row = (await client.get('/cart')).body.cart[0];
  assert.equal(row.product.price, 175);
  assert.equal(row.product.stock, 1);
});

test('a product deleted from the catalogue is hidden from the cart and removable', async () => {
  const { client } = await registerAndLogin('cartgone');
  const p = await createTestProduct(client, { name: 'Vanishing' });
  await client.post(`/cart/${p._id}`);

  await mongoose.connect(MONGO_URI);
  await mongoose.connection.db.collection('products').deleteOne({ _id: new mongoose.Types.ObjectId(p._id) });
  await mongoose.disconnect();

  assert.deepEqual((await client.get('/cart')).body.cart, []);
  assert.equal((await client.delete(`/cart/${p._id}`)).status, 200);
});
