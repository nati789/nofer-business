import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const password = randomBytes(24).toString('hex');
const secret = randomBytes(32).toString('hex');
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3001'],
  {
    env: { ...process.env, APP_PASSWORD: password, SESSION_SECRET: secret },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
server.stdout.on('data', (data) => process.stdout.write(data));
server.stderr.on('data', (data) => process.stderr.write(data));
const base = 'http://127.0.0.1:3001';
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base + '/api/data');
      if (r.status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  assert.ok(ready, 'Production server must start with authentication enforced');
  assert.equal((await fetch(base + '/api/export')).status, 401);
  assert.equal(
    (
      await fetch(base + '/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      })
    ).status,
    401,
  );
  const login = await fetch(base + '/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin: base },
    body: JSON.stringify({ password }),
  });
  assert.equal(login.status, 200);
  const cookieHeader = login.headers.get('set-cookie');
  assert.ok(cookieHeader.includes('HttpOnly') && cookieHeader.includes('Secure'));
  const cookie = cookieHeader.split(';')[0];
  assert.equal((await fetch(base + '/api/data', { headers: { Cookie: cookie } })).status, 200);
  assert.equal(
    (
      await fetch(base + '/api/auth', {
        method: 'DELETE',
        headers: { Cookie: cookie, origin: 'https://other.example' },
      })
    ).status,
    403,
  );
  console.log('Production authentication, protected exports and origin checks passed.');
  const args = process.argv.slice(2);
  const tests = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...args], {
    env: { ...process.env, TEST_SESSION_COOKIE: cookie },
    windowsHide: true,
    stdio: 'inherit',
  });
  const code = await new Promise((resolve) => tests.once('exit', resolve));
  assert.equal(code, 0, 'Browser tests must pass');
  const logout = await fetch(base + '/api/auth', {
    method: 'DELETE',
    headers: { Cookie: cookie, origin: base },
  });
  assert.equal(logout.status, 200);
  console.log('Production checks complete.');
} finally {
  server.kill();
}
