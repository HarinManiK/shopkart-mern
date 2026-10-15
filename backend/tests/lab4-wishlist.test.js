const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient, registerAndLogin, createTestProduct, cleanup } = require('./helpers');

const OBJECT_ID_NOT_IN_DB = '64b64b64b64b64b64b64b64b';

test.after(cleanup);

test('all wishlist endpoints require authentication (401)', async () => {
  const anon = createClient();
  assert.equal((await anon.get('/wishlist')).status, 401);
  assert.equal((await anon.get('/wishlist/count')).status, 401);
  assert.equal((await anon.post(`/wishlist/${OBJECT_ID_NOT_IN_DB}`)).status, 401);
  assert.equal((await anon.delete(`/wishlist/${OBJECT_ID_NOT_IN_DB}`)).status, 401);
  assert.equal((await anon.patch(`/wishlist/${OBJECT_ID_NOT_IN_DB}/toggle`)).status, 401);
});

test('a new customer starts with an empty wishlist', async () => {
  const { client } = await registerAndLogin('empty');
  const res = await client.get('/wishlist');
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 0);
  assert.deepEqual(res.body.wishlist, []);
});

test('add -> duplicate (409) -> get (populated) -> remove -> remove again (404)', async () => {
  const { client } = await registerAndLogin('flow');
  const product = await createTestProduct(client, { name: 'Wish Item', price: 250 });

  const add = await client.post(`/wishlist/${product._id}`);
  assert.equal(add.status, 201);
  assert.equal(add.body.success, true);

  const dup = await client.post(`/wishlist/${product._id}`);
  assert.equal(dup.status, 409);

  const list = await client.get('/wishlist');
  assert.equal(list.body.count, 1);
  const item = list.body.wishlist[0];
  assert.equal(item._id, product._id);
  assert.equal(item.name, product.name); // populated product data, not just an id
  assert.equal(item.price, 250);
  assert.equal(item.description, undefined); // only the selected fields

  assert.equal((await client.get('/wishlist/count')).body.count, 1);

  const del = await client.delete(`/wishlist/${product._id}`);
  assert.equal(del.status, 200);
  assert.equal((await client.get('/wishlist')).body.count, 0);

  assert.equal((await client.delete(`/wishlist/${product._id}`)).status, 404);
});

test('invalid product id -> 400, unknown product -> 404', async () => {
  const { client } = await registerAndLogin('ids');
  assert.equal((await client.post('/wishlist/not-an-id')).status, 400);
  assert.equal((await client.delete('/wishlist/not-an-id')).status, 400);
  assert.equal((await client.post(`/wishlist/${OBJECT_ID_NOT_IN_DB}`)).status, 404);
});

test('wishlists are private per user and persist across logins', async () => {
  const a = await registerAndLogin('userA');
  const b = await registerAndLogin('userB');
  const product = await createTestProduct(a.client, { name: 'Private Item' });

  await a.client.post(`/wishlist/${product._id}`);
  assert.equal((await b.client.get('/wishlist')).body.count, 0);

  // B can't remove A's item either - it's simply not in B's wishlist.
  assert.equal((await b.client.delete(`/wishlist/${product._id}`)).status, 404);

  // The client can never pick the user: a userId in the body/URL is ignored.
  assert.equal((await b.client.post(`/wishlist/${product._id}`, { userId: a.user._id })).status, 201);
  assert.equal((await a.client.get('/wishlist')).body.count, 1);

  // Log A in again from a fresh "browser": data persisted in MongoDB.
  const fresh = createClient();
  await fresh.post('/customers/login', { email: a.email, password: a.password });
  assert.equal((await fresh.get('/wishlist')).body.count, 1);
});

test('concurrent adds of the same product never create duplicates', async () => {
  const { client } = await registerAndLogin('race');
  const product = await createTestProduct(client, { name: 'Race Item' });
  const results = await Promise.all(Array.from({ length: 8 }, () => client.post(`/wishlist/${product._id}`)));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 7);
  assert.equal((await client.get('/wishlist')).body.count, 1);
});

test('toggle (bonus) flips saved state', async () => {
  const { client } = await registerAndLogin('toggle');
  const product = await createTestProduct(client, { name: 'Toggle Item' });
  const on = await client.patch(`/wishlist/${product._id}/toggle`);
  assert.equal(on.body.saved, true);
  assert.equal((await client.get('/wishlist')).body.count, 1);
  const off = await client.patch(`/wishlist/${product._id}/toggle`);
  assert.equal(off.body.saved, false);
  assert.equal((await client.get('/wishlist')).body.count, 0);
});

test('a product deleted from the catalogue disappears from the wishlist', async () => {
  const mongoose = require('mongoose');
  const { MONGO_URI } = require('./helpers');
  const { client } = await registerAndLogin('deleted');
  const product = await createTestProduct(client, { name: 'Soon Deleted' });
  await client.post(`/wishlist/${product._id}`);

  await mongoose.connect(MONGO_URI);
  await mongoose.connection.db.collection('products').deleteOne({ _id: new mongoose.Types.ObjectId(product._id) });
  await mongoose.disconnect();

  const res = await client.get('/wishlist');
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 0);
});
