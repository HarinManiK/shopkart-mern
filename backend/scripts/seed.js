/**
 * Seeds sample products and a demo customer for local development.
 * Safe to re-run: products are upserted by name, so existing ids (and any
 * wishlist/cart/order references to them) are preserved.
 *
 *   npm run seed
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

const Product = require('../models/product.model');
const Customer = require('../models/customer.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shopkart';

// Local-development login only. Never reuse these on a real deployment.
const DEMO_CUSTOMER = {
  fullName: 'Demo Shopper',
  email: 'demo@shopkart.test',
  password: 'demo1234',
  phone: '9876543210'
};

const img = (slug) => `https://picsum.photos/seed/shopkart-${slug}/600/450`;

const products = [
  { name: 'Noise Cancelling Headphones', description: 'Wireless over-ear headphones with active noise cancellation and 30-hour battery life.', price: 4999, category: 'Electronics', image: img('headphones'), stock: 25 },
  { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard with blue switches and aluminium top plate.', price: 2999, category: 'Electronics', image: img('keyboard'), stock: 10 },
  { name: 'Wireless Mouse', description: 'Ergonomic 2.4GHz wireless mouse with silent clicks and adjustable DPI.', price: 1499, category: 'Electronics', image: img('mouse'), stock: 40 },
  { name: 'Smartphone 128GB', description: '6.5-inch AMOLED display, 50MP camera and all-day battery.', price: 15999, category: 'Electronics', image: img('phone'), stock: 5 },
  { name: 'Bluetooth Speaker', description: 'Portable waterproof speaker with deep bass and 12-hour playtime.', price: 2499, category: 'Electronics', image: img('speaker'), stock: 3 },
  { name: 'Classic Denim Jacket', description: 'Regular-fit denim jacket with a soft cotton lining.', price: 2199, category: 'Fashion', image: img('jacket'), stock: 18 },
  { name: 'Running Shoes', description: 'Lightweight breathable running shoes with cushioned sole.', price: 3499, category: 'Fashion', image: img('shoes'), stock: 12 },
  { name: 'Cotton Crew T-Shirt', description: 'Pre-shrunk 100% cotton t-shirt, available in everyday colours.', price: 599, category: 'Fashion', image: img('tshirt'), stock: 100 },
  { name: 'Leather Wallet', description: 'Slim genuine leather wallet with RFID protection.', price: 899, category: 'Fashion', image: img('wallet'), stock: 0 },
  { name: 'Clean Code', description: 'A handbook of agile software craftsmanship by Robert C. Martin.', price: 799, category: 'Books', image: img('cleancode'), stock: 30 },
  { name: 'Atomic Habits', description: 'An easy and proven way to build good habits and break bad ones.', price: 499, category: 'Books', image: img('habits'), stock: 50 },
  { name: 'The Pragmatic Programmer', description: 'Your journey to mastery, 20th anniversary edition.', price: 899, category: 'Books', image: img('pragmatic'), stock: 8 },
  { name: 'Ceramic Coffee Mug Set', description: 'Set of 4 handcrafted ceramic mugs, microwave and dishwasher safe.', price: 699, category: 'Home', image: img('mugs'), stock: 22 },
  { name: 'LED Desk Lamp', description: 'Dimmable LED desk lamp with 3 colour modes and USB charging port.', price: 1299, category: 'Home', image: img('lamp'), stock: 15 },
  { name: 'Cotton Bedsheet Set', description: 'Queen-size 300 thread count cotton bedsheet with 2 pillow covers.', price: 1799, category: 'Home', image: img('bedsheet'), stock: 9 },
  { name: 'Stainless Steel Water Bottle', description: 'Insulated 1L bottle that keeps drinks cold for 24 hours.', price: 549, category: 'Home', image: img('bottle'), stock: 60 }
];

const run = async () => {
  await mongoose.connect(MONGO_URI);

  await Product.bulkWrite(
    products.map((p) => ({
      updateOne: { filter: { name: p.name }, update: { $set: p }, upsert: true }
    }))
  );
  console.log(`Seeded ${products.length} products`);

  const existing = await Customer.findOne({ email: DEMO_CUSTOMER.email });
  if (!existing) {
    const hashed = await bcrypt.hash(DEMO_CUSTOMER.password, 10);
    await Customer.create({ ...DEMO_CUSTOMER, password: hashed });
    console.log(`Created demo customer ${DEMO_CUSTOMER.email}`);
  } else {
    console.log(`Demo customer ${DEMO_CUSTOMER.email} already exists`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
