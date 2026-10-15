# ShopKart Authentication Service — TA Viva Preparation Guide

This document contains concise, technically sound, and academically sharp answers to the viva questions listed in the Lab 01 evaluation rubric.

---

### Q1: Why do we use **bcrypt** instead of encrypting passwords?
**Answer:**
- **Hashing vs. Encryption:** Encryption is a **two-way function** (data can be decrypted back to plaintext using a secret key). If the encryption key is ever compromised, all user passwords are exposed. In contrast, bcrypt is a **cryptographic one-way hashing function**; once hashed, the original password cannot be mathematically reversed.
- **Adaptive Work Factor (Salting & Cost):** bcrypt incorporates an automatic random salt (which prevents pre-computed rainbow table attacks) and a configurable cost factor (work factor / salt rounds). This intentionally slows down the computation, making brute-force and dictionary attacks computationally infeasible.
- **Authentication Mechanism:** During login, we do not decrypt the password. Instead, we hash the candidate password with the stored salt using `bcrypt.compare()` and verify whether the resulting hashes match.

---

### Q2: What information is typically stored inside a JWT payload?
**Answer:**
- **Standard Claims & Identity:** The JWT payload typically stores non-sensitive identity claims such as the user ID (`id` or `sub`), user role (`role: 'customer'`), issued-at timestamp (`iat`), and expiration timestamp (`exp`).
- **Never Store Sensitive Secrets:** Since JWT payloads are merely **Base64Url encoded** (not encrypted), anyone who intercepts the token can read the payload. Therefore, sensitive information—such as plaintext passwords, password hashes, Social Security Numbers, or credit card details—must **never** be stored in a JWT.

---

### Q3: Why is the **HttpOnly** flag important for cookies?
**Answer:**
- **Mitigating Cross-Site Scripting (XSS):** By default, cookies can be read and manipulated by client-side JavaScript via `document.cookie`. If an attacker finds an XSS vulnerability on the site, malicious JavaScript can steal the session/JWT token.
- **Enforced Browser Security:** Setting `httpOnly: true` instructs the web browser that the cookie is strictly accessible by the HTTP protocol and must never be exposed to client-side scripts. The browser automatically attaches this cookie on subsequent HTTP requests to the origin without JavaScript intervention, keeping authentication tokens safe from token-stealing XSS attacks.

---

### Q4: Why should passwords never be returned to the frontend?
**Answer:**
- **Data Exposure & Network Interception:** Even if hashed, returning passwords or password hashes to the frontend exposes them across network hops, browser developer tools, browser memory, client-side logs, and frontend state caches.
- **Rainbow Table & Offline Attack Risks:** If an attacker inspects network traffic or gains access to client state and retrieves the hash, they could attempt offline dictionary or brute-force cracking attacks.
- **Principle of Least Privilege:** The client application has zero legitimate functional need to know the customer's password hash; it only needs user profile data (e.g., name, email, phone) to render the UI.

---

### Q5: What is the purpose of authentication middleware?
**Answer:**
- **Request Interception & Gatekeeping:** Authentication middleware acts as a centralized gatekeeper for protected endpoints. Before a controller action executes, the middleware intercepts the incoming request, extracts the JWT from `req.cookies`, and cryptographically verifies its signature and expiration.
- **User Context Attachment:** Upon successful verification, the middleware looks up the customer record from the database (excluding the password), attaches it to `req.user`, and invokes `next()` to pass control to the target controller.
- **Separation of Concerns (DRY Principle):** It eliminates repetitive authentication checks across dozens of protected controllers, providing a clean, reusable, and secure architecture. If authentication fails, it terminates the request early with a `401 Unauthorized` response.

---

### Bonus Viva Questions

#### B1: What is a Salt, and why is it needed?
- A **salt** is a cryptographically strong random string appended to the password before hashing.
- It ensures that two users who happen to have the exact same password (e.g., `"password123"`) will generate completely distinct hash outputs in the database.
- It completely neutralizes **rainbow table attacks** (precomputed tables of hash values).

#### B2: Why return a generic "Invalid credentials" error instead of "Email not found" or "Wrong password"?
- Revealing whether the email exists enables **user enumeration** attacks. Malicious actors could scan email databases to determine which users are registered on the platform.
- Returning a generic 401 message protects user privacy and adheres to OWASP security guidelines.

#### B3: What does `sameSite: 'strict'` do?
- It instructs the browser not to send the cookie on any cross-site requests (e.g., when following links from external websites). This is the primary defense against **Cross-Site Request Forgery (CSRF)** attacks.
