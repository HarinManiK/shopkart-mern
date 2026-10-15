const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient, createTestProduct, cleanup } = require('./helpers');

const client = createClient();
const VALID = {
  name: 'TEST-Keyboard',
  description: 'RGB mechanical keyboard',
  price: 2999,
  category: 'TestCategory',
  image: 'https://example.com/k.jpg',
  stock: 10
};

test.after(cleanup);

test('POST /products creates a product (201)', async () => {
  const res = await client.post('/products', VALID);
  assert.equal(res.status, 201);
  assert.equal(res.body.product.name, VALID.name);
  assert.ok(res.body.product._id);
  assert.ok(res.body.product.createdAt);
});

for (const field of ['name', 'description', 'price', 'category', 'image', 'stock']) {
  test(`POST /products rejects missing ${field} (400)`, async () => {
    const body = { ...VALID };
    delete body[field];
    const res = await client.post('/products', body);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });
}

test('POST /products rejects price 0, negative price, non-numeric price (400)', async () => {
  for (const price of [0, -5, 'abc']) {
    const res = await client.post('/products', { ...VALID, price });
    assert.equal(res.status, 400, `price=${price}`);
  }
});

test('POST /products rejects negative and fractional stock (400)', async () => {
  for (const stock of [-1, 2.5]) {
    const res = await client.post('/products', { ...VALID, stock });
    assert.equal(res.status, 400, `stock=${stock}`);
  }
});

test('POST /products accepts stock 0', async () => {
  const res = await client.post('/products', { ...VALID, name: 'TEST-ZeroStock', stock: 0 });
  assert.equal(res.status, 201);
});

test('GET /products returns count + lean list without description', async () => {
  await createTestProduct(client);
  const res = await client.get('/products');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, res.body.products.length);
  assert.ok(res.body.count >= 1);
  assert.equal(res.body.products[0].description, undefined);
  for (const f of ['_id', 'name', 'price', 'category', 'image', 'stock']) {
    assert.ok(f in res.body.products[0], `missing ${f}`);
  }
});

test('GET /products?search= is case-insensitive and matches by name', async () => {
  const p = await createTestProduct(client, { name: 'Zebrafish Widget' });
  const res = await client.get('/products?search=zEbRaFiSh');
  assert.equal(res.status, 200);
  assert.ok(res.body.products.some((x) => x._id === p._id));
  assert.ok(res.body.products.every((x) => /zebrafish/i.test(x.name)));
});

test('GET /products?search= treats regex characters literally', async () => {
  const res = await client.get('/products?search=' + encodeURIComponent('(.*'));
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 0);
});

test('GET /products?category= filters, and search+category combine', async () => {
  const a = await createTestProduct(client, { name: 'Combo Alpha', category: 'ComboCat' });
  await createTestProduct(client, { name: 'Combo Alpha', category: 'OtherCat' });
  const byCat = await client.get('/products?category=ComboCat');
  assert.ok(byCat.body.products.length >= 1);
  assert.ok(byCat.body.products.every((x) => x.category === 'ComboCat'));
  const both = await client.get('/products?search=combo alpha&category=ComboCat');
  assert.equal(both.body.count, 1);
  assert.equal(both.body.products[0]._id, a._id);
});

test('GET /products?sort= orders by price (bonus)', async () => {
  await createTestProduct(client, { name: 'Sort Cheap', category: 'SortCat', price: 10 });
  await createTestProduct(client, { name: 'Sort Mid', category: 'SortCat', price: 50 });
  await createTestProduct(client, { name: 'Sort Pricey', category: 'SortCat', price: 500 });
  const asc = (await client.get('/products?category=SortCat&sort=price_asc')).body.products.map((p) => p.price);
  const desc = (await client.get('/products?category=SortCat&sort=price_desc')).body.products.map((p) => p.price);
  assert.deepEqual(asc, [10, 50, 500]);
  assert.deepEqual(desc, [500, 50, 10]);
});

test('GET /products/:id returns the full product (incl. description)', async () => {
  const p = await createTestProduct(client);
  const res = await client.get(`/products/${p._id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.product._id, p._id);
  assert.ok(res.body.product.description);
});

test('GET /products/:id returns 400 for an invalid id', async () => {
  assert.equal((await client.get('/products/not-an-id')).status, 400);
  assert.equal((await client.get('/products/123456789012')).status, 400);
});

test('GET /products/:id returns 404 for a well-formed but unknown id', async () => {
  const res = await client.get('/products/64b64b64b64b64b64b64b64b');
  assert.equal(res.status, 404);
});
