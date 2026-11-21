import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_AGENCY_SETTINGS,
  hasValidationErrors,
  validateAgencySettings,
} from './settings-validation';

test('validateAgencySettings flags missing required fields on initial empty state', () => {
  const errors = validateAgencySettings(INITIAL_AGENCY_SETTINGS);
  assert.equal(hasValidationErrors(errors), true);
  assert.equal(errors.agencyName, 'required');
  assert.equal(errors.email, 'required');
  assert.equal(errors.phone, 'required');
  assert.equal(errors.city, 'required');
  assert.equal(errors.vatRatePercent, undefined);
});

test('validateAgencySettings rejects malformed email, phone, and out-of-range VAT', () => {
  const errors = validateAgencySettings({
    ...INITIAL_AGENCY_SETTINGS,
    agencyName: 'Atlas Mobility',
    email: 'not-an-email',
    phone: '123',
    city: 'Tunis',
    vatRatePercent: '125',
  });
  assert.equal(errors.email, 'invalid_email');
  assert.equal(errors.phone, 'invalid_phone');
  assert.equal(errors.vatRatePercent, 'invalid_vat');
});

test('validateAgencySettings passes with valid Tunisian agency details', () => {
  const errors = validateAgencySettings({
    ...INITIAL_AGENCY_SETTINGS,
    agencyName: 'Atlas Mobility Tunis',
    legalName: 'Atlas Mobility SARL',
    taxId: '1234567/A/M/000',
    email: 'contact@atlas-mobility.tn',
    phone: '+216 71 234 567',
    city: 'Tunis',
    address: 'Avenue Habib Bourguiba, Tunis',
    vatRatePercent: '19',
  });
  assert.equal(hasValidationErrors(errors), false);
});
