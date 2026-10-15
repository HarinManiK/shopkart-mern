# ShopKart — Full-Stack MERN E-commerce

ShopKart is a full-stack online shop built across six lab assignments: customers can register and log in, browse and search products, save a wishlist, manage a cart, pay with **Razorpay (test mode)** and view their order history.

## Features

| Lab | Feature |
|---|---|
| 1 | Customer authentication API: register, login, logout, profile, change password. Passwords hashed with bcrypt, JWT stored in an **HttpOnly cookie** |
| 2 | React auth UI: Register, Login, protected Home, Logout (React Router + Axios) |
| 3 | Product catalogue: create/list/get products, **search**, **category filter**, **sort**, details page, loading / error / empty states |
| 4 | **Wishlist** (MongoDB references + `populate`), duplicate prevention, toggle, navbar count |
| 5 | **Shopping cart** with Redux Toolkit: add / update quantity / remove, stock validation, derived subtotal, navbar count |
| 6 | **Checkout & Orders**: shipping form validation, server-side price/stock checks, Razorpay test payment with **HMAC signature verification**, order history with purchase-time price snapshots |

Bonus items included: product sort, wishlist toggle + count, order status progression (dev-only endpoint).

## Tech stack

- **Frontend:** React 19, Vite, React Router, Axios, Redux Toolkit, plain CSS
- **Backend:** Node.js, Express, Mongoose, bcrypt, jsonwebtoken, cookie-parser, cors, Razorpay SDK
- **Database:** MongoDB
- **Testing:** Node's built-in test runner (`node:test`) — 53 integration tests + the Lab 1 suite; Postman collection included

## Project structure

```
backend/
  index.js                 server entry
  config/razorpay.js       Razorpay client + signature check
  controllers/ routes/     customer, product, wishlist, cart, order
  middlewares/             auth (JWT cookie) middleware
  models/                  Customer, Product, Order
  scripts/seed.js          sample products + demo user
  tests/                   integration tests
  ShopKart_Full_API.postman_collection.json
frontend/src/
  pages/ components/       screens and reusable UI
  context/AuthContext.jsx  logged-in user
  features/cart/           Redux cart slice
  hooks/ services/ utils/  data fetching, API calls, helpers
```

## Run it locally

**Prerequisites:** Node.js 18+ and a running MongoDB (local, Docker/Podman, or MongoDB Atlas).

```bash
# 1. Install dependencies (root, backend, frontend)
npm install
npm --prefix backend install
npm --prefix frontend install

# 2. Create the backend environment file and fill it in (see "Environment variables")
cp backend/.env.example backend/.env

# 3. (Optional) start MongoDB with a container if you don't have it installed
docker run -d --name shopkart-mongo -p 27017:27017 mongo:7      # or use podman

# 4. Load sample products and a demo customer (safe to re-run)
npm --prefix backend run seed

# 5. Start backend (http://localhost:5000) and frontend (http://localhost:5173)
npm run dev
```

Open **http://localhost:5173**. Use `localhost` consistently (cookies are `SameSite=Strict`).
Demo login created by the seed: `demo@shopkart.test` / `demo1234` (local development only — see `backend/scripts/seed.js`).

## Environment variables

Copy `backend/.env.example` to `backend/.env`. The frontend needs no environment variables (Vite proxies API calls to the backend).

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default `5000`) |
| `MONGO_URI` | MongoDB connection string (default `mongodb://127.0.0.1:27017/shopkart`) |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `NODE_ENV` | `development` locally |
| `RAZORPAY_KEY_ID` | Razorpay **test** Key Id (`rzp_test_...`) |
| `RAZORPAY_KEY_SECRET` | Razorpay **test** Key Secret — server only, never commit |

**Razorpay setup (needed only for the payment step):** create a Razorpay account, switch the dashboard to **Test Mode**, then *Account & Settings → API Keys → Generate Test Key* and put the two values in `backend/.env`. Restart the backend. Without them everything works except checkout, which shows "Payment gateway is not configured". In test mode no real money is charged.

## Tests

```bash
npm test    # start the backend first (npm run dev); runs the Lab 1 suite + Lab 3–6 suites
```

Lab 6 tests start their own backend with a mock payment gateway, so they don't need real Razorpay keys. Test data is removed automatically.
To try the API manually, import `backend/ShopKart_Full_API.postman_collection.json` into Postman (run *Login* first).

## Pages and API

| Frontend route | Page |
|---|---|
| `/register`, `/login` | Auth |
| `/home`, `/profile` | Protected |
| `/products`, `/products/:id` | Catalogue |
| `/wishlist`, `/cart` | Saved items / cart |
| `/checkout`, `/order-success/:id` | Checkout |
| `/orders`, `/orders/:id` | Order history |

| Method | API | Auth |
|---|---|:---:|
| POST | `/customers/register`, `/customers/login`, `/customers/logout` | – / – / ✅ |
| GET, PATCH | `/customers/me`, `/customers/change-password` | ✅ |
| POST, GET | `/products`, `/products?search=&category=&sort=` | – |
| GET | `/products/:id` | – |
| GET, POST, DELETE, PATCH | `/wishlist`, `/wishlist/:productId`, `/wishlist/:productId/toggle`, `/wishlist/count` | ✅ |
| GET, POST, PATCH, DELETE | `/cart`, `/cart/:productId` | ✅ |
| POST | `/orders/create-payment-order`, `/orders/verify-payment` | ✅ |
| GET | `/orders`, `/orders/:id` | ✅ |
| PATCH | `/orders/:id/status` (development only) | ✅ |
