export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
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
  return typeof value === 'string' && /^[\d\s\-+()]{7,20}$/.test(value);
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
  assert(isPhone(value), `${formatField(field)} must be a valid phone number`);
}

export function assertValidDateString(value: unknown, field: string): asserts value is string {
  assert(isValidDateString(value), `${formatField(field)} must be a valid date`);
}

export function assertUUID(value: unknown, field: string): asserts value is string {
  assert(isUUID(value), `${formatField(field)} must be a valid UUID`);
}

export function assertOptionalString(value: unknown, field: string): asserts value is string | undefined {
  assert(isUndefinedOrString(value), `${formatField(field)} must be a string if provided`);
}
