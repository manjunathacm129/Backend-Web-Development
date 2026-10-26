/**
 * LU 51 — Authentication Middleware Test Suite
 *
 * Tests run against the Express app without an external test framework.
 * Requires the app to be importable (not calling app.listen in a blocking way).
 */
require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'lu51-test-secret-do-not-use-in-production-32chars';

const http = require('http');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const AUTH_REQUIRED_BODY = {
  error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
};

// Silence the app's listen log during tests
const originalLog = console.log;
console.log = () => {};
const app = require('../src/app');
console.log = originalLog;

const server = http.createServer(app);

function request(server, options, body) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = addr ? addr.port : 0;
    const opts = {
      hostname: '127.0.0.1',
      port,
      path: options.path || '/',
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

function assertAuthFailure(res, message) {
  assert(res.status === 401, `${message}: status is 401 (got ${res.status})`);
  assert(
    JSON.stringify(res.body) === JSON.stringify(AUTH_REQUIRED_BODY),
    `${message}: exact generic authentication response`
  );
}

async function runTests() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  console.log('\nLU 51 — Authentication Middleware Tests\n');

  // ── Test 1: Missing token returns 401 ─────────────────────────────────────
  console.log('Test 1: Missing Authorization header');
  {
    const res = await request(server, { path: '/profile' });
    assertAuthFailure(res, 'Missing Authorization header');
  }

  // ── Test 2: Invalid token returns 401 ─────────────────────────────────────
  console.log('\nTest 2: Invalid/tampered token');
  {
    const res = await request(server, {
      path: '/profile',
      headers: { Authorization: 'Bearer not.a.valid.token' },
    });
    assertAuthFailure(res, 'Malformed JWT');
  }

  // ── Test 2b: Wrong scheme returns 401 ─────────────────────────────────────
  console.log('\nTest 2b: Wrong scheme (Basic)');
  {
    const res = await request(server, {
      path: '/profile',
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    assertAuthFailure(res, 'Wrong Authorization scheme');
  }

  // ── Test 2c: Empty token returns 401 ──────────────────────────────────────
  console.log('\nTest 2c: Empty Bearer token');
  {
    const res = await request(server, {
      path: '/profile',
      headers: { Authorization: 'Bearer   ' },
    });
    assertAuthFailure(res, 'Empty Bearer token');
  }

  // ── Test 2d: Incorrect signature returns 401 ──────────────────────────────
  console.log('\nTest 2d: Incorrectly signed token');
  {
    const token = jwt.sign({ sub: 'user-7' }, 'different-test-secret', { algorithm: 'HS256' });
    const res = await request(server, {
      path: '/profile',
      headers: { Authorization: `Bearer ${token}` },
    });
    assertAuthFailure(res, 'Incorrectly signed token');
  }

  // ── Test 3: Valid token attaches user payload ──────────────────────────────
  console.log('\nTest 3: Valid token attaches req.user');
  {
    const token = jwt.sign({ sub: 'user-7', role: 'member' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    const res = await request(server, {
      path: '/profile',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(res.status === 200, `Status is 200 (got ${res.status})`);
    assert(res.body?.userId === 'user-7', `userId is user-7 (got ${res.body?.userId})`);
  }

  // ── Test 4: Protected routes allow authenticated users ────────────────────
  console.log('\nTest 4: Protected routes respond correctly with valid token');
  {
    for (const [method, path] of [
      ['GET', '/profile'],
      ['GET', '/posts/my'],
      ['POST', '/posts'],
    ]) {
      const unauthenticated = await request(server, { method, path });
      assertAuthFailure(unauthenticated, `${method} ${path} without token`);
    }

    const token = jwt.sign({ sub: 'user-42' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const res1 = await request(server, { path: '/posts/my', headers: { Authorization: `Bearer ${token}` } });
    assert(res1.status === 200, `GET /posts/my returns 200 (got ${res1.status})`);

    const res2 = await request(server, {
      method: 'POST',
      path: '/posts',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    assert(res2.status === 201, `POST /posts returns 201 (got ${res2.status})`);
  }

  // ── Test 5: Expired token returns 401 ─────────────────────────────────────
  console.log('\nTest 5: Expired token returns 401');
  {
    const expiredToken = jwt.sign({ sub: 'user-7' }, SECRET, { algorithm: 'HS256', expiresIn: '0s' });
    await new Promise((r) => setTimeout(r, 100)); // ensure it expires
    const res = await request(server, {
      path: '/profile',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assertAuthFailure(res, 'Expired token');
  }

  // ── Test 6: Public route remains accessible ────────────────────────────────
  console.log('\nTest 6: Public route (POST /auth/login) accessible without token');
  {
    const res = await request(
      server,
      { method: 'POST', path: '/auth/login', headers: { 'Content-Type': 'application/json' } },
      { sub: 'user-1' }
    );
    assert(res.status === 200, `POST /auth/login returns 200 (got ${res.status})`);
    assert(typeof res.body?.token === 'string', `Response contains a token string`);
  }

  server.close();

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nSome tests failed. Check your requireAuth implementation.');
    process.exit(1);
  } else {
    console.log('\nAll tests passed! ✓');
  }
}

runTests().catch((err) => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
