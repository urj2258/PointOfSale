import { describe, it, expect } from 'vitest'
import {
  isPhone, isName, isAddress,
  isProductName, isAllowedUnit, isNonNegativeInteger, isDescription,
} from '../validation.js'

describe('isPhone', () => {
  const valid = [
    '03001234567',
    '03219876543',
    '03451112222',
    '03123456789',
    '03331234567',
    '03411234567',
    '03511234567',
    '923001234567',
    '923219876543',
    '3001234567',
    '3219876543',
    '0211234567',
    '04212345678',
    '0491234567',
    '92211234567',
    '924212345678',
    '+92 300 1234567',
    '+92-321-9876543',
    '(021) 1234567',
    '0300 123 4567',
    '0300-123-4567',
    '  03001234567  ',
  ]

  const invalid = [
    '',
    'abc',
    '0300123456',
    '030012345678',
    '03001234',
    '01234567890',
    '03abcdefghi',
    'adadadaa',
    '+92 300 abcdefg',
    '12345',
    '0001234567',
    '922123456',
    '051123456',
    '0300abc1234',
    '+92abc1234567',
    'hello world',
    '1234567890123456',
    null,
    undefined,
    1234567890,
  ]

  valid.forEach((num) => {
    it(`accepts "${num}"`, () => {
      expect(isPhone(num)).toBe(true)
    })
  })

  invalid.forEach((num) => {
    it(`rejects ${JSON.stringify(num)}`, () => {
      expect(isPhone(num as unknown)).toBe(false)
    })
  })
})

describe('isName', () => {
  const valid = [
    'Ahmed Traders',
    'ABC',
    'Khan Textile Mill 123',
    'a]b[c',
    'John Doe - Branch 2',
  ]

  const invalid = [
    '',
    'ab',
    '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901', // 101 chars
    '123',
    '12345',
    '***',
    '---',
    '!!!@@@',
    null,
    undefined,
    123,
  ]

  valid.forEach((name) => {
    it(`accepts "${name}"`, () => {
      expect(isName(name)).toBe(true)
    })
  })

  invalid.forEach((name) => {
    it(`rejects ${JSON.stringify(name)}`, () => {
      expect(isName(name as unknown)).toBe(false)
    })
  })
})

describe('isAddress', () => {
  const valid = [
    'Main Boulevard Lahore',
    'Shop 5, Star Mall',
    'Street 12, Blue Area Islamabad',
    'Gulshan-e-Iqbal Block 5',
    'near Tahir Chowrangi Karachi',
  ]

  const invalid = [
    '',
    'abcd',
    '1234',
    '12345',
    '123456',
    '-----',
    '!!!!!',
    null,
    undefined,
    12345,
  ]

  valid.forEach((addr) => {
    it(`accepts "${addr}"`, () => {
      expect(isAddress(addr)).toBe(true)
    })
  })

  invalid.forEach((addr) => {
    it(`rejects ${JSON.stringify(addr)}`, () => {
      expect(isAddress(addr as unknown)).toBe(false)
    })
  })
})

describe('isProductName', () => {
  const valid = [
    'Portland Cement',
    'Tata Steel Bar',
    'Honda CG 125',
    'abc',
    'Product 42 Detail',
  ]

  const invalid = [
    '',
    'ab',
    '12345',
    '43242343',
    '!!!@@@',
    '---',
    null,
    undefined,
    123,
  ]

  valid.forEach((name) => {
    it(`accepts "${name}"`, () => {
      expect(isProductName(name)).toBe(true)
    })
  })

  invalid.forEach((name) => {
    it(`rejects ${JSON.stringify(name)}`, () => {
      expect(isProductName(name as unknown)).toBe(false)
    })
  })
})

describe('isAllowedUnit', () => {
  const valid = [
    'kg', 'Kg', 'KG',
    'ton', 'pieces', 'pcs',
    'liter', 'meter', 'feet',
    'bag', 'box', 'roll',
    'dozen', 'quintal',
    'set', 'pair', 'unit',
    'bottle', 'drum', 'sack',
  ]

  const invalid = [
    '',
    'bruh',
    'random',
    'butterfly',
    'xyz',
    null,
    undefined,
    123,
  ]

  valid.forEach((unit) => {
    it(`accepts "${unit}"`, () => {
      expect(isAllowedUnit(unit)).toBe(true)
    })
  })

  invalid.forEach((unit) => {
    it(`rejects ${JSON.stringify(unit)}`, () => {
      expect(isAllowedUnit(unit as unknown)).toBe(false)
    })
  })
})

describe('isNonNegativeInteger', () => {
  const valid = [0, 1, 42, 999, 100000]

  const invalid = [
    -1, -0.5, 0.5, 3.14,
    NaN, Infinity, -Infinity,
    '0', '1', null, undefined,
  ]

  valid.forEach((n) => {
    it(`accepts ${n}`, () => {
      expect(isNonNegativeInteger(n)).toBe(true)
    })
  })

  invalid.forEach((n) => {
    it(`rejects ${JSON.stringify(n)}`, () => {
      expect(isNonNegativeInteger(n as unknown)).toBe(false)
    })
  })
})

describe('isDescription', () => {
  const valid = [
    'High quality cement for construction',
    'Grade A steel bar 12mm',
    'Premium motor oil 10W-40',
  ]

  const invalid = [
    '',
    'abcd',
    '1234',
    '12345',
    '123456',
    '-----',
    '!!!!!',
    null,
    undefined,
    12345,
  ]

  valid.forEach((desc) => {
    it(`accepts "${desc}"`, () => {
      expect(isDescription(desc)).toBe(true)
    })
  })

  invalid.forEach((desc) => {
    it(`rejects ${JSON.stringify(desc)}`, () => {
      expect(isDescription(desc as unknown)).toBe(false)
    })
  })
})
