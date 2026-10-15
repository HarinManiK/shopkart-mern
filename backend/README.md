# ShopKart — Backend (Labs 01–06)

> Labs 02–06 extend this service with products, wishlist, cart, checkout and orders. See the **root README** for the full route table, setup and Razorpay keys, and `VIVA_GUIDE.md` for viva prep. The rest of this file documents the original Lab 01 auth API.

## Overview
ShopKart Customer Authentication Service is a secure, RESTful backend module engineered with **Node.js**, **Express.js**, and **MongoDB (Mongoose)**, following the **Model-View-Controller (MVC)** architectural pattern.

This service manages customer lifecycle authentication including registration, login, cookie-based JWT authorization, profile retrieval, logout, and password updates.

---

## Architectural Structure

```text
backend/
├── controllers/
│   └── customer.controller.js       # Handles request logic, validation, and responses
├── models/
│   └── customer.model.js            # Mongoose schema for Customer collection
├── routes/
│   └── customer.routes.js           # API route declarations & middleware attachment
├── middlewares/
│   └── auth.middleware.js           # JWT verification & customer context binding
├── utils/
│   └── generateToken.js             # JWT signing and HttpOnly cookie configuration
├── index.js                         # Application entrypoint & DB connection
├── .env                             # Environment configuration
├── package.json                     # Project manifest and scripts
├── test-auth.js                     # Automated end-to-end integration test suite
├── ShopKart_Auth_API.postman_collection.json # Ready-to-import Postman collection
└── VIVA_QUESTIONS.md                # Comprehensive TA viva study guide
```

---

## Technical Specifications & Security Features

1. **Password Hashing (bcrypt)**:
   - Uses `bcrypt.genSalt(10)` and `bcrypt.hash()`.
   - Never stores plaintext passwords.
   - Passwords are automatically stripped from all JSON responses via schema-level overrides and query projections (`.select("-password")`).
2. **JWT in HttpOnly Cookies**:
   - Authentication tokens are generated using `jsonwebtoken` with 7-day expiration.
   - Tokens are delivered in cookies flagged with:
     - `httpOnly: true`: Blocks client-side JavaScript access (prevents token theft via XSS).
     - `sameSite: 'strict'`: Defends against Cross-Site Request Forgery (CSRF).
     - `secure`: Automatically activated in production mode.
3. **Generic Error Responses**:
   - Login failures return generic `"Invalid credentials"` (HTTP 401) to prevent user enumeration attacks.
4. **Clean Error Handling & Status Codes**:
   - HTTP 200: Successful retrieval / operation
   - HTTP 201: Resource created (registration)
   - HTTP 400: Bad request (missing fields, validation failure)
   - HTTP 401: Unauthorized (missing/expired token, wrong credentials)
   - HTTP 409: Conflict (duplicate email)
   - HTTP 500: Server error

---

## API Documentation

### 1. Register Customer
- **Method**: `POST`
- **Path**: `/customers/register`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "fullName": "John Doe",
    "email": "john@gmail.com",
    "password": "john123",
    "phone": "9876543210"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Customer registered successfully",
    "customer": {
      "_id": "67...a1",
      "fullName": "John Doe",
      "email": "john@gmail.com",
      "phone": "9876543210"
    }
  }
  ```

---

### 2. Login Customer
- **Method**: `POST`
- **Path**: `/customers/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "john@gmail.com",
    "password": "john123"
  }
  ```
- **Success Response (200 OK)**:
  - Sets `token` inside `Set-Cookie` header (`HttpOnly; Path=/; SameSite=Strict`).
  ```json
  {
    "success": true,
    "message": "Login successful"
  }
  ```

---

### 3. Get My Profile
- **Method**: `GET`
- **Path**: `/customers/me`
- **Access**: Protected (Requires `token` cookie)
- **Success Response (200 OK)**:
  ```json
  {
    "_id": "67...a1",
    "fullName": "John Doe",
    "email": "john@gmail.com",
    "phone": "9876543210"
  }
  ```

---

### 4. Change Password (Bonus Challenge)
- **Method**: `PATCH`
- **Path**: `/customers/change-password`
- **Access**: Protected (Requires `token` cookie)
- **Request Body**:
  ```json
  {
    "oldPassword": "john123",
    "newPassword": "newStrongPassword456"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Password changed successfully"
  }
  ```

---

### 5. Logout
- **Method**: `POST`
- **Path**: `/customers/logout`
- **Access**: Protected (Requires `token` cookie)
- **Success Response (200 OK)**:
  - Clears `token` cookie.
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

---

## Quick Start Guide

### 1. Start MongoDB
Ensure MongoDB is running locally (default URI: `mongodb://127.0.0.1:27017/shopkart`).

### 2. Start the Server
```bash
cd backend
npm start
# or for live reloading:
npm run dev
```

The server will be operational at `http://localhost:5000`.

### 3. Run Automated Tests
```bash
npm test
```
All 15 verification tests will execute against your running database and print clear PASS/FAIL markers.

### 4. Postman Import
Import `ShopKart_Auth_API.postman_collection.json` directly into Postman. The collection has pre-configured request bodies and cookie jars to test with TAs seamlessly.
