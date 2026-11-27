import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DRIVER_LICENCE_WARNING_DAYS,
  DEFAULT_TUNISIA_DRIVER_RULE_SET,
  DRIVER_ELIGIBILITY_LEGAL_NOTICE,
  createDriverEligibilityRuleSet,
  evaluateDriverEligibility,
  getAgencyTodayIsoDate,
  isValidDriverLicenceDate,
  normalizeIsoCountryCode,
  normalizeLicenceCategory,
  summarizeCustomerDriversEligibility,
} from './eligibility';
import {
  canManageCustomerDrivers,
  canReadCustomerDrivers,
} from './types';

// Fixed reference timestamp: 2026-06-15 10:00:00 UTC (2026-06-15 11:00 in Africa/Tunis)
const REF_NOW = new Date('2026-06-15T10:00:00.000Z');

test('never declares a driver automatically legally eligible even when all metadata checks pass', () => {
  const result = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2028-12-31',
      verification_status: 'verified',
      is_active: true,
    },
    {
      now: REF_NOW,
      timeZone: 'Africa/Tunis',
      requiredLicenceCategory: 'B',
      rentalEndDate: '2026-06-22',
    }
  );

  assert.equal(result.status, 'checks_passed_manual_review_required');
  assert.equal(result.requiresCountrySpecificVerification, true);
  assert.equal(result.legalNotice, DRIVER_ELIGIBILITY_LEGAL_NOTICE);
  assert.equal(result.licenceExpiryStatus, 'valid_for_window');
  assert.equal(result.blockingCount, 0);
  assert.equal(result.warningCount, 0);
  assert.equal(result.infoCount, 0);
  assert.equal(result.flags.length, 0);
});

test('flags missing licence expiry date and missing verification as attention_required', () => {
  const result = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: null,
      verification_status: 'unverified',
      is_active: true,
    },
    { now: REF_NOW }
  );

  assert.equal(result.status, 'attention_required');
  assert.equal(result.licenceExpiryStatus, 'missing');
  assert.equal(result.daysUntilExpiry, null);
  const codes = result.flags.map((f) => f.code);
  assert.ok(codes.includes('licence_expiry_missing'));
  assert.ok(codes.includes('verification_unverified'));
});

test('blocks expired driving licences with negative daysUntilExpiry', () => {
  const result = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2026-06-14',
      verification_status: 'verified',
      is_active: true,
    },
    { now: REF_NOW }
  );

  assert.equal(result.status, 'blocked');
  assert.equal(result.licenceExpiryStatus, 'expired');
  assert.equal(result.daysUntilExpiry, -1);
  assert.ok(result.flags.some((f) => f.code === 'licence_expired' && f.severity === 'blocking'));
});

test('flags approaching expiry within default 30-day window and respects boundary', () => {
  assert.equal(DEFAULT_DRIVER_LICENCE_WARNING_DAYS, 30);

  // Exactly 30 days ahead -> expiring_soon
  const atBoundary = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2026-07-15',
      verification_status: 'verified',
    },
    { now: REF_NOW }
  );
  assert.equal(atBoundary.licenceExpiryStatus, 'expiring_soon');
  assert.equal(atBoundary.daysUntilExpiry, 30);
  assert.equal(atBoundary.status, 'attention_required');
  assert.ok(atBoundary.flags.some((f) => f.code === 'licence_expiring_soon'));

  // 31 days ahead -> valid_for_window
  const outsideBoundary = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2026-07-16',
      verification_status: 'verified',
    },
    { now: REF_NOW }
  );
  assert.equal(outsideBoundary.licenceExpiryStatus, 'valid_for_window');
  assert.equal(outsideBoundary.daysUntilExpiry, 31);
  assert.equal(outsideBoundary.status, 'checks_passed_manual_review_required');
});

test('blocks when licence expires before the planned rental end date', () => {
  const result = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2026-06-20',
      verification_status: 'verified',
    },
    {
      now: REF_NOW,
      rentalEndDate: '2026-06-25',
    }
  );

  assert.equal(result.status, 'blocked');
  assert.equal(result.expiresBeforeRentalEnd, true);
  assert.ok(result.flags.some((f) => f.code === 'licence_expires_during_rental'));
  assert.ok(result.flags.some((f) => f.code === 'licence_expiring_soon'));
});

test('handles pending, rejected, and inactive driver statuses accurately', () => {
  const pending = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2028-01-01',
      verification_status: 'pending',
    },
    { now: REF_NOW }
  );
  assert.equal(pending.status, 'attention_required');
  assert.ok(pending.flags.some((f) => f.code === 'verification_pending'));

  const rejected = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2028-01-01',
      verification_status: 'rejected',
    },
    { now: REF_NOW }
  );
  assert.equal(rejected.status, 'blocked');
  assert.ok(rejected.flags.some((f) => f.code === 'verification_rejected'));

  const inactive = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2028-01-01',
      verification_status: 'verified',
      is_active: false,
    },
    { now: REF_NOW }
  );
  assert.equal(inactive.status, 'blocked');
  assert.ok(inactive.flags.some((f) => f.code === 'driver_inactive'));
});

test('detects potential licence-category mismatch and supports configurable jurisdiction rule sets', () => {
  // Driver with category B attempting a vehicle requiring category C -> warning
  const mismatch = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2028-01-01',
      verification_status: 'verified',
    },
    {
      now: REF_NOW,
      requiredLicenceCategory: 'C',
    }
  );
  assert.equal(mismatch.status, 'attention_required');
  assert.ok(
    mismatch.flags.some(
      (f) => f.code === 'licence_category_mismatch' && f.severity === 'warning'
    )
  );

  // Driver with category BE satisfies required category B under default equivalences
  const equivalent = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'BE',
      licence_expires_on: '2028-01-01',
      verification_status: 'verified',
    },
    {
      now: REF_NOW,
      requiredLicenceCategory: 'B',
    }
  );
  assert.equal(equivalent.status, 'checks_passed_manual_review_required');
  assert.equal(equivalent.warningCount, 0);

  // Configurable Morocco rule set with 45-day warning threshold and foreign licence notice
  const moroccoRuleSet = createDriverEligibilityRuleSet({
    id: 'MA_STANDARD',
    jurisdictionCode: 'MA',
    warningThresholdDays: 45,
  });
  const foreignInMorocco = evaluateDriverEligibility(
    {
      licence_issuing_country: 'FR',
      licence_category: 'B',
      licence_expires_on: '2026-07-25', // 40 days from 2026-06-15 -> within 45d threshold
      verification_status: 'verified',
    },
    {
      now: REF_NOW,
      ruleSet: moroccoRuleSet,
      requiredLicenceCategory: 'B',
    }
  );
  assert.equal(foreignInMorocco.ruleSetId, 'MA_STANDARD');
  assert.equal(foreignInMorocco.jurisdictionCode, 'MA');
  assert.equal(foreignInMorocco.licenceExpiryStatus, 'expiring_soon');
  assert.ok(
    foreignInMorocco.flags.some(
      (f) => f.code === 'foreign_licence_manual_check' && f.severity === 'info'
    )
  );
  assert.equal(DEFAULT_TUNISIA_DRIVER_RULE_SET.jurisdictionCode, 'TN');
});

test('evaluates dates using Africa/Tunis agency timezone around midnight boundary', () => {
  // 2026-06-15 23:30 UTC is already 2026-06-16 00:30 in Africa/Tunis (UTC+1)
  const nearMidnightUtc = new Date('2026-06-15T23:30:00.000Z');
  assert.equal(getAgencyTodayIsoDate('Africa/Tunis', nearMidnightUtc), '2026-06-16');

  const result = evaluateDriverEligibility(
    {
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2026-06-15',
      verification_status: 'verified',
    },
    {
      now: nearMidnightUtc,
      timeZone: 'Africa/Tunis',
    }
  );

  assert.equal(result.referenceDate, '2026-06-16');
  assert.equal(result.licenceExpiryStatus, 'expired');
  assert.equal(result.daysUntilExpiry, -1);
});

test('summarizes eligibility across multiple authorized drivers for a customer and validates RBAC + normalizers', () => {
  const summary = summarizeCustomerDriversEligibility(
    [
      {
        licence_issuing_country: 'TN',
        licence_category: 'B',
        licence_expires_on: '2028-05-01',
        verification_status: 'verified',
        is_active: true,
      },
      {
        licence_issuing_country: 'TN',
        licence_category: 'B',
        licence_expires_on: '2026-06-25',
        verification_status: 'pending',
        is_active: true,
      },
      {
        licence_issuing_country: 'TN',
        licence_category: 'B',
        licence_expires_on: '2025-01-01',
        verification_status: 'verified',
        is_active: true,
      },
      {
        licence_issuing_country: null,
        licence_category: null,
        licence_expires_on: null,
        verification_status: 'unverified',
        is_active: false,
      },
    ],
    { now: REF_NOW }
  );

  assert.equal(summary.totalDrivers, 4);
  assert.equal(summary.activeDrivers, 3);
  assert.equal(summary.checksPassedManualReviewCount, 1);
  assert.equal(summary.attentionRequiredCount, 1);
  assert.equal(summary.blockedCount, 2);
  assert.equal(summary.expiredLicenceCount, 1);
  assert.equal(summary.expiringSoonLicenceCount, 1);
  assert.equal(summary.missingExpiryCount, 1);

  // RBAC alignment with migration 0007
  assert.equal(canManageCustomerDrivers('owner'), true);
  assert.equal(canManageCustomerDrivers('manager'), true);
  assert.equal(canManageCustomerDrivers('agent'), false);

  assert.equal(canReadCustomerDrivers('owner'), true);
  assert.equal(canReadCustomerDrivers('manager'), true);
  assert.equal(canReadCustomerDrivers('agent'), true);

  // Normalizers & date validator
  assert.equal(normalizeIsoCountryCode(' tn '), 'TN');
  assert.equal(normalizeIsoCountryCode('TUN'), null);
  assert.equal(normalizeLicenceCategory(' b e '), 'BE');
  assert.equal(normalizeLicenceCategory('123'), null);
  assert.equal(isValidDriverLicenceDate('2026-02-28'), true);
  assert.equal(isValidDriverLicenceDate('2026-02-29'), false);
  assert.equal(isValidDriverLicenceDate('1979-12-31'), false);
});
