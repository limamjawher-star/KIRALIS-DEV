export interface AgencySettingsFormValues {
  agencyName: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  currency: 'TND';
  timezone: 'Africa/Tunis';
  defaultLanguage: 'fr' | 'en' | 'ar';
  vatRatePercent: string;
}

export type AgencySettingsField = keyof AgencySettingsFormValues;

export type ValidationErrorCode =
  | 'required'
  | 'invalid_email'
  | 'invalid_phone'
  | 'invalid_vat';

export type AgencySettingsErrors = Partial<
  Record<AgencySettingsField, ValidationErrorCode>
>;

export const INITIAL_AGENCY_SETTINGS: AgencySettingsFormValues = {
  agencyName: '',
  legalName: '',
  taxId: '',
  email: '',
  phone: '',
  city: '',
  address: '',
  currency: 'TND',
  timezone: 'Africa/Tunis',
  defaultLanguage: 'fr',
  vatRatePercent: '19',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s\-()]{8,20}$/;

export function validateAgencySettings(
  values: AgencySettingsFormValues
): AgencySettingsErrors {
  const errors: AgencySettingsErrors = {};

  if (!values.agencyName.trim()) {
    errors.agencyName = 'required';
  }

  if (!values.email.trim()) {
    errors.email = 'required';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'invalid_email';
  }

  if (!values.phone.trim()) {
    errors.phone = 'required';
  } else if (!PHONE_PATTERN.test(values.phone.trim())) {
    errors.phone = 'invalid_phone';
  }

  if (!values.city.trim()) {
    errors.city = 'required';
  }

  const vat = Number(values.vatRatePercent.replace(',', '.'));
  if (
    !values.vatRatePercent.trim() ||
    !Number.isFinite(vat) ||
    vat < 0 ||
    vat > 100
  ) {
    errors.vatRatePercent = 'invalid_vat';
  }

  return errors;
}

export function hasValidationErrors(errors: AgencySettingsErrors): boolean {
  return Object.keys(errors).length > 0;
}
