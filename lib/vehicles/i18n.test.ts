import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { reduceSeasonalToggleUiState } from '@/components/vehicles/vehicle-pricing-section';
import { formatTndFromMillimes, type SupportedLocale } from '@/lib/currency';
import {
  buildLocalizedAppliedRulesExplanation,
  formatComplianceRelativeDaysLocalized,
  formatDateTimeLocalized,
  formatIsoDateLocalized,
  formatOdometerLocalized,
  formatSignedDeltaTndLocalized,
  getLocalizedLineItemLabel,
  getLocalizedVehicleCategoryLabel,
  getVehiclesCopy,
  localizeSeasonalFieldErrors,
  localizeVehicleFieldErrors,
} from '@/lib/vehicles/i18n';
import {
  calculateRentalPricePreview,
  type PricingErrorCode,
} from '@/lib/vehicles/pricing';
import {
  VEHICLE_CATEGORY_OPTIONS,
  VEHICLE_FUEL_VALUES,
  VEHICLE_SORT_OPTIONS,
  VEHICLE_STATUS_VALUES,
  VEHICLE_TRANSMISSION_VALUES,
} from '@/lib/vehicles/types';

const LOCALES: readonly SupportedLocale[] = ['fr', 'en', 'ar'];
const ARABIC_CHAR_RE = /[\u0600-\u06FF]/;

test('1. Vehicles i18n dictionary provides complete non-empty FR, EN, and AR coverage for all core enums', () => {
  for (const locale of LOCALES) {
    const copy = getVehiclesCopy(locale);

    for (const status of VEHICLE_STATUS_VALUES) {
      assert.ok(
        copy.statuses[status].trim().length > 0,
        `Missing status label for ${locale}.${status}`
      );
    }

    for (const opt of VEHICLE_CATEGORY_OPTIONS) {
      assert.ok(
        copy.categories[opt.value].trim().length > 0,
        `Missing category label for ${locale}.${opt.value}`
      );
    }

    for (const tr of VEHICLE_TRANSMISSION_VALUES) {
      assert.ok(
        copy.transmissions[tr].trim().length > 0,
        `Missing transmission label for ${locale}.${tr}`
      );
    }

    for (const fuel of VEHICLE_FUEL_VALUES) {
      assert.ok(
        copy.fuels[fuel].trim().length > 0,
        `Missing fuel label for ${locale}.${fuel}`
      );
    }

    for (const sortOpt of VEHICLE_SORT_OPTIONS) {
      assert.ok(
        copy.sortOptions[sortOpt.value].trim().length > 0,
        `Missing sort label for ${locale}.${sortOpt.value}`
      );
    }

    const errorCodes: PricingErrorCode[] = [
      'invalid_pickup_date',
      'invalid_return_date',
      'invalid_date_range',
      'range_too_long',
      'invalid_vehicle_rates',
      'invalid_seasonal_rule',
      'overlapping_seasonal_rules',
    ];
    for (const code of errorCodes) {
      assert.ok(
        copy.simulator.errors[code].trim().length > 0,
        `Missing simulator error for ${locale}.${code}`
      );
    }
  }

  const fr = getVehiclesCopy('fr');
  const en = getVehiclesCopy('en');
  const ar = getVehiclesCopy('ar');

  // Verify EN is genuinely translated from FR
  assert.notEqual(en.header.title, fr.header.title);
  assert.notEqual(en.header.addVehicle, fr.header.addVehicle);
  assert.notEqual(en.kpis.totalLabel, fr.kpis.totalLabel);
  assert.notEqual(en.simulator.title, fr.simulator.title);
  assert.notEqual(en.drawer.sectionSpecs, fr.drawer.sectionSpecs);

  // Verify AR uses real Arabic script across key labels
  assert.match(ar.header.title, ARABIC_CHAR_RE);
  assert.match(ar.header.addVehicle, ARABIC_CHAR_RE);
  assert.match(ar.statuses.available, ARABIC_CHAR_RE);
  assert.match(ar.complianceStatuses.expired, ARABIC_CHAR_RE);
  assert.match(ar.complianceDocuments.insurance.label, ARABIC_CHAR_RE);
  assert.match(ar.simulator.title, ARABIC_CHAR_RE);
  assert.match(ar.drawer.sectionSpecs, ARABIC_CHAR_RE);
  assert.match(ar.form.createTitle, ARABIC_CHAR_RE);
});

test('2. Database/user-entered values (custom categories and seasonal labels) are preserved verbatim across locales', () => {
  for (const locale of LOCALES) {
    assert.equal(
      getLocalizedVehicleCategoryLabel('Cabriolet VIP', locale),
      'Cabriolet VIP'
    );

    const seasonalLabel = getLocalizedLineItemLabel(
      {
        kind: 'daily_seasonal',
        label: 'Tarif saisonnier — Promo Ramadan',
        periodStart: '2026-03-01',
        periodEndInclusive: '2026-03-10',
        quantity: 10,
        daysCovered: 10,
        unitRateMinor: 140_000,
        subtotalMinor: 1_400_000,
        standardBaselineMinor: 1_000_000,
        deltaVsStandardMinor: 400_000,
        ruleId: 'rule-1',
        ruleLabel: 'Promo Ramadan',
      },
      locale
    );
    assert.ok(
      seasonalLabel.includes('Promo Ramadan'),
      `Custom seasonal ruleLabel must be preserved in ${locale}`
    );
  }
});

test('3. Compliance date/relative-day formatters and 3-decimal TND helpers work accurately across FR, EN, and AR', () => {
  assert.equal(formatIsoDateLocalized('2026-12-05', 'fr'), '05/12/2026');
  assert.equal(formatIsoDateLocalized('2026-12-05', 'en'), '05/12/2026');
  assert.equal(formatIsoDateLocalized('2026-12-05', 'ar'), '05/12/2026');

  assert.equal(formatIsoDateLocalized(null, 'fr'), 'Non renseignée');
  assert.equal(formatIsoDateLocalized(null, 'en'), 'Not provided');
  assert.match(formatIsoDateLocalized(null, 'ar'), ARABIC_CHAR_RE);

  assert.equal(formatComplianceRelativeDaysLocalized(0, 'fr'), 'Expire aujourd’hui');
  assert.equal(formatComplianceRelativeDaysLocalized(0, 'en'), 'Expires today');
  assert.equal(formatComplianceRelativeDaysLocalized(0, 'ar'), 'تنتهي اليوم');

  assert.equal(
    formatComplianceRelativeDaysLocalized(-3, 'en'),
    'Expired 3 days ago'
  );
  assert.equal(formatComplianceRelativeDaysLocalized(12, 'en'), 'In 12 days');
  assert.match(
    formatComplianceRelativeDaysLocalized(-2, 'ar'),
    ARABIC_CHAR_RE
  );

  // Exact 3-decimal TND precision preserved
  assert.equal(
    formatSignedDeltaTndLocalized(0, 'en'),
    formatTndFromMillimes(0, 'en')
  );
  assert.equal(
    formatSignedDeltaTndLocalized(25_500, 'en'),
    `+${formatTndFromMillimes(25_500, 'en')}`
  );
  assert.equal(
    formatSignedDeltaTndLocalized(-12_750, 'fr'),
    `−${formatTndFromMillimes(12_750, 'fr')}`
  );

  // Odometer and datetime helpers return clean non-empty strings
  assert.ok(formatOdometerLocalized(45200, 'en').includes('45'));
  assert.ok(
    formatDateTimeLocalized(
      '2026-11-20T10:30:00.000Z',
      'Africa/Tunis',
      'en'
    ).length > 0
  );
});

test('4. Pricing simulator explanation localizes cleanly without altering deterministic TND math', () => {
  const preview = calculateRentalPricePreview({
    vehicle: {
      daily_rate_minor: 100_000,
      weekly_rate_minor: 600_000,
      monthly_rate_minor: null,
      currency_code: 'TND',
    },
    seasonalRules: [
      {
        id: 'summer-1',
        label: 'Summer Peak',
        start_date: '2026-07-08',
        end_date: '2026-07-10',
        daily_rate_minor: 150_000,
        is_active: true,
      },
    ],
    pickupDate: '2026-07-01',
    returnDate: '2026-07-11',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(preview.ok, true);
  if (!preview.ok) return;

  // 7 standard days (600,000) + 3 seasonal days (450,000) = 1,050,000 millimes
  assert.equal(preview.subtotalMinor, 1_050_000);

  const enLines = buildLocalizedAppliedRulesExplanation(preview, 'en');
  assert.ok(enLines.some((line) => line.includes('7-day package')));
  assert.ok(enLines.some((line) => line.includes('3 seasonal days')));

  const arLines = buildLocalizedAppliedRulesExplanation(preview, 'ar');
  assert.ok(arLines.length >= 3);
  for (const line of arLines) {
    assert.match(line, ARABIC_CHAR_RE);
  }
});

test('5. Validation error translator maps known errors across EN/AR while preserving custom server errors', () => {
  const vehicleErrors = localizeVehicleFieldErrors(
    {
      plate_number: 'Le numéro d’immatriculation est obligatoire.',
      daily_rate_minor:
        'Indiquez un tarif journalier valide positif en TND (max 3 décimales).',
      notes: 'Custom server message from PostgreSQL',
    },
    'en'
  );

  assert.equal(vehicleErrors.plate_number, 'License plate is required.');
  assert.equal(
    vehicleErrors.daily_rate_minor,
    'Enter a valid non-negative daily rate in TND (up to 3 decimals).'
  );
  assert.equal(
    vehicleErrors.notes,
    'Custom server message from PostgreSQL'
  );

  const seasonalErrorsAr = localizeSeasonalFieldErrors(
    {
      end_date:
        'La date de fin doit être postérieure ou égale à la date de début.',
    },
    'ar'
  );
  assert.match(seasonalErrorsAr.end_date ?? '', ARABIC_CHAR_RE);
});

test('6. Seasonal toggle reducer supports localized feedback while keeping French default backwards compatibility', () => {
  const baseState = {
    togglingId: 'r1',
    loadError: 'old error',
    formError: null,
    feedback: null,
  };

  // Default (no feedbackMessage) keeps exact French fallback required by existing tests
  const defaultFrench = reduceSeasonalToggleUiState(baseState, {
    type: 'success',
    isActive: false,
  });
  assert.equal(defaultFrench.feedback, 'Tarif saisonnier désactivé.');

  // Localized override
  const localizedEn = reduceSeasonalToggleUiState(baseState, {
    type: 'success',
    isActive: true,
    feedbackMessage: getVehiclesCopy('en').pricing.ruleActivatedFeedback,
  });
  assert.equal(localizedEn.feedback, 'Seasonal rate reactivated.');
  assert.equal(localizedEn.loadError, null);
});

test('7. Regression: Vehicles UI components eliminate previously hardcoded French labels and enforce LTR formatting', () => {
  const vehiclesDir = path.join(process.cwd(), 'components/vehicles');
  const files = [
    'vehicles-workspace.tsx',
    'vehicle-detail-drawer.tsx',
    'vehicle-form-modal.tsx',
    'vehicle-pricing-section.tsx',
    'vehicle-price-simulator.tsx',
    'vehicle-status-badge.tsx',
    'vehicle-compliance-badge.tsx',
  ];

  const forbiddenHardcodedFrench = [
    'Total flotte',
    'Ajouter un véhicule',
    'Simulateur de tarif',
    'Filtres et tri',
    'Caractéristiques techniques',
    'Modifier le véhicule',
    'Documents expirés',
    'Sous-total indicatif',
    'Aucun tarif saisonnier configuré',
    'Échéances administratives',
  ];

  for (const fileName of files) {
    const src = fs.readFileSync(path.join(vehiclesDir, fileName), 'utf8');
    assert.match(
      src,
      /getVehiclesCopy/,
      `${fileName} must consume getVehiclesCopy for FR/EN/AR localization`
    );

    for (const phrase of forbiddenHardcodedFrench) {
      assert.equal(
        src.includes(phrase),
        false,
        `Found hardcoded French phrase "${phrase}" in ${fileName}`
      );
    }
  }

  // Verify explicit dir="ltr" protection for plates/VINs/prices/dates in core components
  const workspaceSrc = fs.readFileSync(
    path.join(vehiclesDir, 'vehicles-workspace.tsx'),
    'utf8'
  );
  const drawerSrc = fs.readFileSync(
    path.join(vehiclesDir, 'vehicle-detail-drawer.tsx'),
    'utf8'
  );
  const formSrc = fs.readFileSync(
    path.join(vehiclesDir, 'vehicle-form-modal.tsx'),
    'utf8'
  );
  const simulatorSrc = fs.readFileSync(
    path.join(vehiclesDir, 'vehicle-price-simulator.tsx'),
    'utf8'
  );

  assert.match(workspaceSrc, /dir="ltr"/);
  assert.match(drawerSrc, /dir="ltr"/);
  assert.match(formSrc, /dir="ltr"/);
  assert.match(simulatorSrc, /dir="ltr"/);
});
