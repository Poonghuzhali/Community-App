const { strict: assert } = require('node:assert');
const { test } = require('node:test');

const v = require('../src/utils/validators');
const { ApiError } = require('../src/utils/errors');

test('str: required field missing throws 422 with a field message', () => {
  const rule = v.str({ required: true, label: 'Title' });
  assert.throws(() => rule(undefined), (err) => err instanceof ApiError && err.status === 422);
  assert.throws(() => rule(''), (err) => err.status === 422);
  assert.equal(rule('  Hello  '), 'Hello');

  const optional = v.str({ label: 'Note' });
  assert.equal(optional(undefined), null);
});

test('str: enforces max length', () => {
  const rule = v.str({ max: 5, label: 'Name' });
  assert.throws(() => rule('too-long-value'), /under 5 characters/);
});

test('int: rejects non-integers and out-of-range values', () => {
  const rule = v.int({ min: 1, max: 10, label: 'Count' });
  assert.equal(rule('5'), 5);
  assert.throws(() => rule('5.5'), /whole number/);
  assert.throws(() => rule('0'), /at least 1/);
  assert.throws(() => rule('99'), /at most 10/);
  assert.equal(rule(undefined), null);
});

test('bool: parses common truthy/falsey strings', () => {
  const rule = v.bool({ fallback: false });
  assert.equal(rule('true'), true);
  assert.equal(rule('1'), true);
  assert.equal(rule('no'), false);
  assert.equal(rule(undefined), false);
  assert.throws(() => rule('maybe'));
});

test('oneOf: validates enum membership', () => {
  const rule = v.oneOf(['a', 'b'], { label: 'Kind' });
  assert.equal(rule('a'), 'a');
  assert.throws(() => rule('c'), /must be one of: a, b/);
});

test('phone: normalises +91 / 0 prefix and rejects invalid numbers', () => {
  assert.equal(v.normalizePhone('+91 98765 43210'), '9876543210');
  assert.equal(v.normalizePhone('09876543210'), '9876543210');
  assert.equal(v.normalizePhone('919876543210'), '9876543210');

  const rule = v.phone({ required: true, label: 'Mobile' });
  assert.equal(rule('9876543210'), '9876543210');
  assert.throws(() => rule('12345'), /valid 10-digit/);
  assert.throws(() => rule('5876543210'), /valid 10-digit/); // must start 6-9
});

test('shape: collects every field error instead of failing on the first', () => {
  const schema = v.shape({
    title: v.str({ required: true, label: 'Title' }),
    age: v.int({ required: true, min: 1, label: 'Age' }),
  });
  assert.throws(
    () => schema({ age: '0' }),
    (err) => {
      assert.equal(err.status, 422);
      assert.equal(err.details.length, 2);
      assert.deepEqual(err.details.map((d) => d.field).sort(), ['age', 'title']);
      return true;
    }
  );
  assert.deepEqual(schema({ title: 'Hi', age: '21' }), { title: 'Hi', age: 21 });
});

test('isoDate: accepts ISO strings and rejects junk', () => {
  const rule = v.isoDate({ required: true, label: 'Date' });
  assert.equal(rule('2026-11-08T18:00:00.000Z'), '2026-11-08T18:00:00.000Z');
  assert.throws(() => rule('not-a-date'), /valid date/);
});
