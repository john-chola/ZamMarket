const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getAllowedOrigins } = require('../utils/corsOrigins');
const { escapeRegex } = require('../utils/escapeRegex');

test('CORS: dev origins always allowed, FRONTEND_URL added', () => {
  const none = getAllowedOrigins({});
  assert.ok(none.includes('http://localhost:5173'));

  const some = getAllowedOrigins({ FRONTEND_URL: 'https://zammarket.vercel.app/, https://zammarket-git-main.vercel.app' });
  assert.ok(some.includes('https://zammarket.vercel.app'), 'trailing slash removed');
  assert.ok(some.includes('https://zammarket-git-main.vercel.app'));
  assert.equal(new Set(some).size, some.length, 'no duplicates');
});

test('escapeRegex makes user input literal', () => {
  const input = 'K95 (hardwood)*+?';
  const re = new RegExp(escapeRegex(input));
  assert.ok(re.test('Charcoal K95 (hardwood)*+? bags'));
  assert.ok(!re.test('K95 hardwood'));
  assert.equal(escapeRegex('(a+)+$'), '\\(a\\+\\)\\+\\$');
});

test('upload errors become clear 400 messages', () => {
  const { errorHandler } = require('../middleware/errorHandler');
  const res = { status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  const tooBig = Object.assign(new Error('File too large'), { name: 'MulterError', code: 'LIMIT_FILE_SIZE' });
  const quiet = console.error; console.error = () => {};
  errorHandler(tooBig, {}, res, () => {});
  assert.equal(res.code, 400);
  assert.match(res.body.message, /larger than 5 MB/);
  errorHandler(new Error('Only JPG, PNG, and WebP images are allowed'), {}, res, () => {});
  console.error = quiet;
  assert.equal(res.code, 400);
});
