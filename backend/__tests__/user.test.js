const bcrypt = require('bcryptjs');
const User = require('../models/User');

const valid = { phone: '+260977123456', name: 'Test User', password: 'secret1' };

describe('User model validation', () => {
  test('accepts a valid Zambian phone number', () => {
    expect(new User(valid).validateSync()).toBeUndefined();
  });

  test('rejects an invalid phone number', () => {
    const err = new User({ ...valid, phone: '12345' }).validateSync();
    expect(err.errors.phone).toBeDefined();
  });

  test('rejects a password shorter than 6 characters', () => {
    const err = new User({ ...valid, password: 'abc' }).validateSync();
    expect(err.errors.password).toBeDefined();
  });

  test('new users default to the buyer role', () => {
    expect(new User(valid).role).toBe('buyer');
  });
});

describe('User.comparePassword', () => {
  test('returns true for the correct password and false for a wrong one', async () => {
    const hash = await bcrypt.hash('secret1', 4);
    const user = new User({ ...valid, password: hash });
    expect(await user.comparePassword('secret1')).toBe(true);
    expect(await user.comparePassword('wrong')).toBe(false);
  });
});

describe('User.publicProfile', () => {
  test('masks the middle digits of the phone number', () => {
    expect(new User(valid).publicProfile.phone).toContain('****');
  });

  test('regression: does not throw when phone was not selected', () => {
    // Populating a user with a limited field list leaves phone undefined.
    // This used to crash with "Cannot read properties of undefined (reading 'replace')".
    const partial = new User({ name: 'Only Name' });
    expect(() => partial.publicProfile).not.toThrow();
    expect(partial.publicProfile.phone).toBeNull();
  });
});