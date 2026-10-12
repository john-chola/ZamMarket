// Run with: npm run test:voice
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseListing, wordsToDigits, parseBestAlternative, NEIGHBOURHOOD_VALUES } from './parseListing.js';
import { readFileSync } from 'node:fs';
import { NEIGHBOURHOODS } from '../../utils/validation.js';

const expectFields = (said, expected) => {
  const got = parseListing(said);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(got[key], value, `"${said}" → ${key}: expected ${value}, got ${got[key]}`);
  }
};

test('number words become digits', () => {
  assert.equal(wordsToDigits('ninety five'), '95');
  assert.equal(wordsToDigits('one hundred and twenty'), '120');
  assert.equal(wordsToDigits('a hundred'), '100');
  assert.equal(wordsToDigits('one thousand two hundred'), '1200');
  assert.equal(wordsToDigits('twenty five kg bags'), '25 kg bags');
  assert.equal(wordsToDigits('five ten'), '5 10');
  assert.equal(wordsToDigits('ten bags at fifty'), '10 bags at 50');
  assert.equal(wordsToDigits('a bag'), 'a bag');
});

test('the four phrases that already worked still work', () => {
  expectFields('charcoal 10 bags K95 each Kanyama', { price: 95, quantity: 10, neighbourhood: 'Kanyama', unit: 'bag' });
  expectFields('I am selling 5 bags of charcoal for 120 kwacha in Mtendere', { price: 120, quantity: 5, neighbourhood: 'Mtendere' });
  expectFields('hardwood charcoal 20 tins K40 Chilenje', { price: 40, quantity: 20, neighbourhood: 'Chilenje', unit: 'tin', title: 'Hardwood charcoal by the tin' });
  expectFields('charcoal K150 per bag 3 bags Matero', { price: 150, quantity: 3, neighbourhood: 'Matero' });
});

test('the two phrases that used to fail now pass', () => {
  expectFields('charcoal for sale ninety five kwacha ten bags', { price: 95, quantity: 10 });
  expectFields('charcoal 8 bags at 100 Libala', { price: 100, quantity: 8, neighbourhood: 'Libala' });
});

test('price is found in many spoken forms', () => {
  expectFields('charcoal K95', { price: 95 });
  expectFields('charcoal k 95', { price: 95 });
  expectFields('95 kwachas a bag', { price: 95 });
  expectFields('price is 80', { price: 80 });
  expectFields('selling at 70 per bag', { price: 70 });
  expectFields('charcoal 60 each', { price: 60 });
  expectFields('one hundred and fifty kwacha per bag', { price: 150 });
  expectFields('K1,200 for the lot', { price: 1200 });
});

test('a number before a unit is a quantity, not a price', () => {
  expectFields('selling charcoal for 5 bags', { price: null, quantity: 5 });
  expectFields('I have 12 bags for 90 kwacha each', { price: 90, quantity: 12 });
});

test('bag size is not mistaken for quantity', () => {
  expectFields('25kg bags of charcoal, 6 bags, K200 each, Kabwata', {
    price: 200, quantity: 6, neighbourhood: 'Kabwata', title: 'Charcoal — 25kg bags', unit: 'bag',
  });
  expectFields('fifty kilo sacks K350 Woodlands', { price: 350, title: 'Charcoal — 50kg bags', neighbourhood: 'Woodlands' });
});

test('per-kg selling sets unit to kg', () => {
  expectFields('charcoal K15 per kg 100 kg available Bauleni', { price: 15, quantity: 100, unit: 'kg', neighbourhood: 'Bauleni' });
});

test('neighbourhoods map to backend enum values', () => {
  expectFields('charcoal in town K90', { neighbourhood: 'Lusaka_CBD' });
  expectFields('charcoal city center', { neighbourhood: 'Lusaka_CBD' });
  expectFields('charcoal Chelstone', { neighbourhood: 'Chelstone' });
  expectFields('charcoal Kalingalinga', { neighbourhood: 'Kalingalinga' });
  expectFields('charcoal somewhere else', { neighbourhood: null });
  expectFields('charcoal Kafue South K100', { neighbourhood: 'Kafue South' });
  expectFields('ten bags chonwe east', { neighbourhood: 'Chongwe East' });
  expectFields('charcoal in Chongwe West', { neighbourhood: 'Chongwe West' });
});

test('voice, form and backend use the same neighbourhood list', () => {
  const backend = (file) => {
    const src = readFileSync(new URL(`../../../../backend/models/${file}`, import.meta.url), 'utf8');
    const block = src.slice(src.indexOf('neighbourhood:'));
    return block.slice(block.indexOf('['), block.indexOf(']')).match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  };
  const withoutOther = (list) => list.filter((n) => n !== 'Other');
  assert.deepEqual(withoutOther(NEIGHBOURHOODS), NEIGHBOURHOOD_VALUES);
  assert.deepEqual(backend('Listing.js'), NEIGHBOURHOODS);
  assert.deepEqual(backend('User.js'), NEIGHBOURHOODS);
});

test('title is a clean phrase, not leftover words', () => {
  expectFields('mixed charcoal 4 bags K100', { title: 'Mixed charcoal' });
  expectFields('charcoal 4 bags K100', { title: 'Charcoal' });
  expectFields('hello testing', { title: null });
});

test('nonsense and empty input give empty fields, not crashes', () => {
  for (const said of ['', '   ', 'hello', 'k', 'bags', '0 bags K0']) {
    const p = parseListing(said);
    assert.equal(p.price, null);
    assert.equal(p.quantity, null);
  }
  assert.equal(parseListing(undefined).price, null);
});

test('absurd values are rejected', () => {
  expectFields('charcoal K5000000', { price: null });
  expectFields('999999 bags', { quantity: null });
});

test('best alternative is the one with most fields', () => {
  const best = parseBestAlternative(['charcoal ten bags', 'charcoal 10 bags K95 Kanyama', '']);
  assert.equal(best.transcript, 'charcoal 10 bags K95 Kanyama');
  assert.equal(parseBestAlternative(['', '  ']), null);
});
