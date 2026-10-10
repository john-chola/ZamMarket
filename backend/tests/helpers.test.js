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
