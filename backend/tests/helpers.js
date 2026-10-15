/**
 * Shared helpers for the integration tests. The tests talk to a RUNNING server
 * (npm start / npm run dev) over HTTP, exactly like Postman or the React app,
 * and use mongoose directly only to create/clean up test data.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: require('path').join(__dirname, '..', '.env') });

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5000';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shopkart';

// A tiny HTTP client that remembers cookies (so it behaves like a browser session).
const createClient = () => {
  let cookie = '';

  const request = async (method, path, body) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;

    const res = await fetch(BASE_URL + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const setCookies = res.headers.getSetCookie();
    if (setCookies.length) {
      const tokenCookie = setCookies.find((c) => c.startsWith('token='));
      if (tokenCookie) {
        const pair = tokenCookie.split(';')[0];
        cookie = pair === 'token=' ? '' : pair; // a cleared cookie is "token=;"
      }
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON response */
    }
    return { status: res.status, body: data, headers: res.headers };
  };

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    patch: (path, body) => request('PATCH', path, body ?? {}),
    delete: (path) => request('DELETE', path),
    hasCookie: () => Boolean(cookie)
  };
};

const uniqueSuffix = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

// Registers a brand-new customer and logs them in; returns { client, user }.
const registerAndLogin = async (label = 'tester') => {
  const client = createClient();
  const email = `test-${label}-${uniqueSuffix()}@shopkart.test`;
  const password = 'secret123';
  const reg = await client.post('/customers/register', {
    fullName: `Test ${label}`,
    email,
    password,
    phone: '9876543210'
  });
  if (reg.status !== 201) throw new Error(`register failed: ${JSON.stringify(reg.body)}`);
  const login = await client.post('/customers/login', { email, password });
  if (login.status !== 200) throw new Error(`login failed: ${JSON.stringify(login.body)}`);
  const me = await client.get('/customers/me');
  return { client, user: me.body, email, password };
};

// Creates a throw-away product through the public API.
const createTestProduct = async (client, overrides = {}) => {
  const res = await client.post('/products', {
    name: `TEST-${overrides.name || 'Product'}-${uniqueSuffix()}`,
    description: 'Created by the automated tests',
    price: 100,
    category: 'TestCategory',
    image: 'https://example.com/test.jpg',
    stock: 10,
    ...overrides,
    ...(overrides.name ? { name: `TEST-${overrides.name}-${uniqueSuffix()}` } : {})
  });
  if (res.status !== 201) throw new Error(`product create failed: ${JSON.stringify(res.body)}`);
  return res.body.product;
};

// Removes everything the tests created (test customers, test products, their orders).
const cleanup = async () => {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const customers = await db.collection('customers').find({ email: /^test-.*@shopkart\.test$/ }).project({ _id: 1 }).toArray();
  const ids = customers.map((c) => c._id);
  await db.collection('orders').deleteMany({ user: { $in: ids } });
  await db.collection('customers').deleteMany({ _id: { $in: ids } });
  await db.collection('products').deleteMany({ name: /^TEST-/ });
  await mongoose.disconnect();
};

module.exports = { BASE_URL, MONGO_URI, createClient, registerAndLogin, createTestProduct, cleanup, uniqueSuffix };
