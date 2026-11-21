import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTndFromMillimes,
  parseTndToMillimes,
  sumMillimes,
} from './currency';

test('formatTndFromMillimes formats zero and positive amounts with 3 decimal places', () => {
  const zeroFr = formatTndFromMillimes(0, 'fr');
  assert.match(zeroFr, /^0,000 TND$/);

  const amountEn = formatTndFromMillimes(125500, 'en');
  assert.equal(amountEn, '125.500 TND');

  const smallEn = formatTndFromMillimes(5, 'en');
  assert.equal(smallEn, '0.005 TND');
});

test('parseTndToMillimes parses comma and dot strings into exact integer millimes', () => {
  assert.equal(parseTndToMillimes('0'), 0);
  assert.equal(parseTndToMillimes('145,5'), 145500);
  assert.equal(parseTndToMillimes('145.250'), 145250);
  assert.equal(parseTndToMillimes('-12,005'), -12005);
  assert.equal(parseTndToMillimes('12.3456'), null);
  assert.equal(parseTndToMillimes('abc'), null);
});

test('sumMillimes avoids floating-point drift across fractional dinars', () => {
  const total = sumMillimes([100, 200, 300, 400]);
  assert.equal(total, 1000);
  assert.equal(formatTndFromMillimes(total, 'en'), '1.000 TND');
});
