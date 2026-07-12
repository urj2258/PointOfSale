export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function handleIpcError(err: unknown): { error: string } {
  if (err instanceof ValidationError) {
    return { error: err.message };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { error: msg };
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value);
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value) && value >= 0;
}

const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'protonmail.com',
  'proton.me',
  'icloud.com',
  'mail.com',
  'aol.com',
  'yandex.com',
  'gmx.com',
  'fastmail.com',
  'zoho.com',
  'tutanota.com',
];

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isAllowedEmailDomain(value: unknown): value is string {
  if (!isEmail(value)) return false;
  const domain = value.split('@')[1].toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

export function isPhone(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (/[^0-9+\-\s()]/.test(v)) return false;
  const digits = v.replace(/[^0-9]/g, '');
  if (/^03\d{9}$/.test(digits)) return true;
  if (/^923\d{9}$/.test(digits)) return true;
  if (/^3\d{9}$/.test(digits)) return true;
  if (/^0[24-9]\d{8,9}$/.test(digits)) return true;
  if (/^92[24-9]\d{8,9}$/.test(digits)) return true;
  return false;
}

export function isName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length < 3 || v.length > 100) return false;
  if (/^\d+$/.test(v)) return false;
  if (/^[^a-zA-Z0-9]+$/.test(v)) return false;
  return true;
}

export function isAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length < 5 || v.length > 250) return false;
  if (/^\d+$/.test(v)) return false;
  if (/^[^a-zA-Z0-9]+$/.test(v)) return false;
  return true;
}

export const ALLOWED_UNITS = [
  'bag', 'bags',
  'ton', 'tons',
  'kg', 'kgs',
  'gram', 'grams',
  'liter', 'liters',
  'ml',
  'meter', 'meters',
  'cm', 'mm',
  'feet', 'foot',
  'inch', 'inches',
  'yard', 'yards',
  'pieces', 'piece', 'pcs',
  'box', 'boxes',
  'carton', 'cartons',
  'roll', 'rolls',
  'drum', 'drums',
  'can', 'cans',
  'bottle', 'bottles',
  'sack', 'sacks',
  'bundle', 'bundles',
  'sheet', 'sheets',
  'coil', 'coils',
  'tank', 'tanks',
  'set', 'sets',
  'pair', 'pairs',
  'unit', 'units',
  'dozen', 'dozens',
  'quintal', 'quintals',
] as const;

export type AllowedUnit = (typeof ALLOWED_UNITS)[number];

export function isAllowedUnit(value: unknown): value is AllowedUnit {
  if (typeof value !== 'string') return false;
  return ALLOWED_UNITS.includes(value.trim().toLowerCase() as AllowedUnit);
}

export function isProductName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length < 3 || v.length > 100) return false;
  if (/^\d+$/.test(v)) return false;
  if (/^[^a-zA-Z0-9]+$/.test(v)) return false;
  return true;
}

export function isNonNegativeInteger(value: unknown): value is number {
  if (typeof value !== 'number') return false;
  if (!Number.isFinite(value)) return false;
  if (!Number.isInteger(value)) return false;
  return value >= 0;
}

export function isDescription(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length < 5 || v.length > 500) return false;
  if (/^\d+$/.test(v)) return false;
  if (/^[^a-zA-Z0-9]+$/.test(v)) return false;
  return true;
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

export function isUUID(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isUndefinedOrString(value: unknown): value is string | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function formatField(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

export function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  assert(isNonEmptyString(value), `${formatField(field)} is required and must be a non-empty string`);
}

export function assertNumber(value: unknown, field: string): asserts value is number {
  assert(isNumber(value), `${formatField(field)} must be a valid number`);
}

export function assertPositiveNumber(value: unknown, field: string): asserts value is number {
  assert(isPositiveNumber(value), `${formatField(field)} must be a positive number`);
}

export function assertNonNegativeNumber(value: unknown, field: string): asserts value is number {
  assert(isNonNegativeNumber(value), `${formatField(field)} cannot be negative`);
}

export function assertEmail(value: unknown, field: string): asserts value is string {
  assert(isEmail(value), `${formatField(field)} must be a valid email address`);
  assert(isAllowedEmailDomain(value), `${formatField(field)} domain is not allowed. Only gmail.com and outlook.com are accepted.`);
}

export function assertPhone(value: unknown, field: string): asserts value is string {
  assert(isNonEmptyString(value), `${formatField(field)} is required`);
  assert(isPhone(value), `${formatField(field)} must be a valid Pakistani phone number (e.g. 03xxxxxxxxx or +923xxxxxxxxx)`);
}

export function assertName(value: unknown, field: string): asserts value is string {
  assert(isName(value), `${formatField(field)} is required, must be 3-100 characters, and cannot be purely numbers or special characters`);
}

export function assertAddress(value: unknown, field: string): asserts value is string {
  assert(isAddress(value), `${formatField(field)} is required, must be 5-250 characters with a meaningful street/area name`);
}

export function assertProductName(value: unknown, field: string): asserts value is string {
  assert(isProductName(value), `${formatField(field)} is required, must be 3-100 characters, and cannot be purely numbers or special characters`);
}

export function assertAllowedUnit(value: unknown, field: string): asserts value is AllowedUnit {
  assert(isAllowedUnit(value), `${formatField(field)} must be one of: ${ALLOWED_UNITS.join(', ')}`);
}

export function assertNonNegativeInteger(value: unknown, field: string): asserts value is number {
  assert(isNonNegativeInteger(value), `${formatField(field)} must be a valid whole number (0 or greater)`);
}

export function assertInteger(value: unknown, field: string): asserts value is number {
  assert(typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value !== 0, `${formatField(field)} must be a non-zero whole number`);
}

export function assertDescription(value: unknown, field: string): asserts value is string {
  assert(isDescription(value), `${formatField(field)} must be 5-500 characters and cannot be purely numbers or special characters`);
}

export function assertOptionalString(value: unknown, field: string): asserts value is string | undefined {
  assert(isUndefinedOrString(value), `${formatField(field)} must be a string if provided`);
}

export function assertValidDateString(value: unknown, field: string): asserts value is string {
  assert(isValidDateString(value), `${formatField(field)} must be a valid date`);
}

export function assertUUID(value: unknown, field: string): asserts value is string {
  assert(isUUID(value), `${formatField(field)} must be a valid UUID`);
}
