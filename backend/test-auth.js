/**
 * ShopKart Authentication Integration Test Suite
 * Tests all endpoints and rubric requirements automatically.
 */
const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000';
let authCookie = '';

// Helper function to send HTTP requests with JSON and cookie support
const request = ({ method, path, body, cookie }) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;

    const headers = {};
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          let parsedData;
          try {
            parsedData = JSON.parse(responseBody);
          } catch (e) {
            parsedData = responseBody;
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedData
          });
        });
      }
    );

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('====================================================');
  console.log('Starting ShopKart Authentication API Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details}`);
      failed++;
    }
  };

  const testEmail = `testuser_${Date.now()}@gmail.com`;
  const initialPassword = 'password123';
  const newPassword = 'newSecretPass456';

  try {
    // 1. Health check
    const health = await request({ method: 'GET', path: '/' });
    assert(health.statusCode === 200, 'Health check returns 200 OK');

    // 2. Register: Missing field validation (400)
    const regMissing = await request({
      method: 'POST',
      path: '/customers/register',
      body: {
        fullName: 'Test User',
        email: testEmail,
        password: initialPassword
        // phone is missing
      }
    });
    assert(
      regMissing.statusCode === 400 && regMissing.body.success === false,
      'Register: Fails with 400 when phone number is missing'
    );

    // 3. Register: Password too short validation (400)
    const regShortPass = await request({
      method: 'POST',
      path: '/customers/register',
      body: {
        fullName: 'Test User',
        email: testEmail,
        password: '123', // < 6 chars
        phone: '9876543210'
      }
    });
    assert(
      regShortPass.statusCode === 400 && regShortPass.body.success === false,
      'Register: Fails with 400 when password is less than 6 characters'
    );

    // 4. Register: Success (201)
    const regSuccess = await request({
      method: 'POST',
      path: '/customers/register',
      body: {
        fullName: 'John Doe',
        email: testEmail,
        password: initialPassword,
        phone: '9876543210'
      }
    });
    assert(
      regSuccess.statusCode === 201 &&
        regSuccess.body.success === true &&
        regSuccess.body.customer &&
        regSuccess.body.customer.email === testEmail &&
        regSuccess.body.customer.password === undefined,
      'Register: Success with 201 and password is excluded from response'
    );

    // 5. Register: Duplicate email (409)
    const regDuplicate = await request({
      method: 'POST',
      path: '/customers/register',
      body: {
        fullName: 'Duplicate User',
        email: testEmail,
        password: initialPassword,
        phone: '9876543210'
      }
    });
    assert(
      regDuplicate.statusCode === 409 && regDuplicate.body.success === false,
      'Register: Rejects duplicate email with 409 Conflict'
    );

    // 6. Login: Invalid credentials (wrong password) (401)
    const loginWrongPass = await request({
      method: 'POST',
      path: '/customers/login',
      body: {
        email: testEmail,
        password: 'wrongPassword999'
      }
    });
    assert(
      loginWrongPass.statusCode === 401 &&
        loginWrongPass.body.message === 'Invalid credentials',
      'Login: Returns 401 with generic "Invalid credentials" message on wrong password'
    );

    // 7. Login: Invalid credentials (non-existent email) (401)
    const loginWrongEmail = await request({
      method: 'POST',
      path: '/customers/login',
      body: {
        email: 'nobody@gmail.com',
        password: initialPassword
      }
    });
    assert(
      loginWrongEmail.statusCode === 401 &&
        loginWrongEmail.body.message === 'Invalid credentials',
      'Login: Returns 401 with generic "Invalid credentials" without revealing email absence'
    );

    // 8. Login: Success (200) & Set-Cookie HttpOnly
    const loginSuccess = await request({
      method: 'POST',
      path: '/customers/login',
      body: {
        email: testEmail,
        password: initialPassword
      }
    });
    const setCookieHeader = loginSuccess.headers['set-cookie'];
    const hasTokenCookie = setCookieHeader && setCookieHeader.some((c) => c.includes('token='));
    const isHttpOnly = setCookieHeader && setCookieHeader.some((c) => c.toLowerCase().includes('httponly'));

    assert(
      loginSuccess.statusCode === 200 &&
        loginSuccess.body.success === true &&
        hasTokenCookie &&
        isHttpOnly,
      'Login: Returns 200 and sets JWT inside HttpOnly cookie'
    );

    if (setCookieHeader && setCookieHeader[0]) {
      authCookie = setCookieHeader[0].split(';')[0];
    }

    // 9. Protected Profile: Access without Cookie (401)
    const profileNoCookie = await request({
      method: 'GET',
      path: '/customers/me'
    });
    assert(
      profileNoCookie.statusCode === 401,
      'Profile: Accessing /customers/me without cookie returns 401 Unauthorized'
    );

    // 10. Protected Profile: Access with valid Cookie (200)
    const profileWithCookie = await request({
      method: 'GET',
      path: '/customers/me',
      cookie: authCookie
    });
    assert(
      profileWithCookie.statusCode === 200 &&
        profileWithCookie.body.email === testEmail &&
        profileWithCookie.body.fullName === 'John Doe' &&
        profileWithCookie.body.password === undefined,
      'Profile: Accessing /customers/me with cookie returns 200 with customer data (no password)'
    );

    // 11. Bonus Challenge: Change Password - Wrong Old Password (400)
    const changePassWrongOld = await request({
      method: 'PATCH',
      path: '/customers/change-password',
      cookie: authCookie,
      body: {
        oldPassword: 'incorrectOldPassword',
        newPassword: newPassword
      }
    });
    assert(
      changePassWrongOld.statusCode === 400 &&
        changePassWrongOld.body.message === 'Incorrect old password',
      'Change Password (Bonus): Rejects incorrect old password with 400 Bad Request'
    );

    // 12. Bonus Challenge: Change Password - Success (200)
    const changePassSuccess = await request({
      method: 'PATCH',
      path: '/customers/change-password',
      cookie: authCookie,
      body: {
        oldPassword: initialPassword,
        newPassword: newPassword
      }
    });
    assert(
      changePassSuccess.statusCode === 200 && changePassSuccess.body.success === true,
      'Change Password (Bonus): Successfully updates password with 200 OK'
    );

    // 13. Verify Login with New Password
    const loginWithNewPass = await request({
      method: 'POST',
      path: '/customers/login',
      body: {
        email: testEmail,
        password: newPassword
      }
    });
    assert(
      loginWithNewPass.statusCode === 200,
      'Verification: Login succeeds with newly updated password'
    );

    // 14. Logout: Success (200) & Clears Cookie
    const logoutRes = await request({
      method: 'POST',
      path: '/customers/logout',
      cookie: authCookie
    });
    const logoutCookie = logoutRes.headers['set-cookie'];
    const cookieCleared =
      logoutCookie &&
      logoutCookie.some((c) => c.includes('token=;') || c.includes('Expires=Thu, 01 Jan 1970'));

    assert(
      logoutRes.statusCode === 200 && logoutRes.body.success === true && cookieCleared,
      'Logout: Returns 200 and clears authentication cookie'
    );

    // 15. Profile after Logout with cleared cookie (401)
    const profileAfterLogout = await request({
      method: 'GET',
      path: '/customers/me',
      cookie: 'token=;'
    });
    assert(
      profileAfterLogout.statusCode === 401,
      'Profile: Accessing /customers/me after logout returns 401 Unauthorized'
    );

    console.log('\n====================================================');
    console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    if (serverProcess) {
      serverProcess.kill();
    }
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test run error:', err);
    if (serverProcess) {
      serverProcess.kill();
    }
    process.exit(1);
  }
};

const { spawn } = require('child_process');
let serverProcess = null;

const checkServerRunning = () => {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:5000/', (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
  });
};

const main = async () => {
  const isRunning = await checkServerRunning();
  if (!isRunning) {
    console.log('Starting ShopKart auth server for testing...');
    serverProcess = spawn('node', ['index.js'], {
      cwd: __dirname,
      stdio: 'ignore'
    });

    // Wait for server to boot
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const up = await checkServerRunning();
      if (up) break;
    }
  }

  await runTests();
};

main();

