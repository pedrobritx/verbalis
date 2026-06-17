import { describe, expect, it } from 'vitest'
import {
  convertNumerals,
  extractNumbers,
  isNumberOnly,
  numeralScriptForLang,
  sameNumberMultiset,
  toLatinDigits,
} from '@/core/numbers'

describe('toLatinDigits', () => {
  it('converts Arabic-Indic digits', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
  })
  it('converts Eastern Arabic-Indic (Persian) digits', () => {
    expect(toLatinDigits('۰۱۲۳')).toBe('0123')
  })
  it('converts Devanagari digits', () => {
    expect(toLatinDigits('०१२३')).toBe('0123')
  })
  it('leaves Latin digits and letters untouched', () => {
    expect(toLatinDigits('abc 50 def')).toBe('abc 50 def')
  })
})

describe('convertNumerals', () => {
  it('converts Latin to Arabic-Indic', () => {
    expect(convertNumerals('50', 'arab')).toBe('٥٠')
  })
  it('round-trips through latn', () => {
    expect(convertNumerals('٥٠', 'latn')).toBe('50')
  })
})

describe('numeralScriptForLang', () => {
  it('maps ar to arab', () => expect(numeralScriptForLang('ar-JO')).toBe('arab'))
  it('maps fa to arabext', () => expect(numeralScriptForLang('fa')).toBe('arabext'))
  it('maps hi to deva', () => expect(numeralScriptForLang('hi')).toBe('deva'))
  it('defaults to latn', () => expect(numeralScriptForLang('en-US')).toBe('latn'))
})

describe('extractNumbers', () => {
  it('extracts plain integers and decimals', () => {
    expect(extractNumbers('I have 50 apples and 3.5 kg')).toEqual(['50', '3.5'])
  })
  it('treats grouped and ungrouped thousands as equal value', () => {
    expect(extractNumbers('1,000')).toEqual(['1000'])
    expect(extractNumbers('1000')).toEqual(['1000'])
  })
  it('normalizes Arabic-Indic numerals before extracting', () => {
    expect(extractNumbers('السعر ٥٠')).toEqual(['50'])
  })
})

describe('sameNumberMultiset', () => {
  it('is order independent', () => {
    expect(sameNumberMultiset(['50', '3'], ['3', '50'])).toBe(true)
  })
  it('detects a swapped value (memoQ 7676-instead-of-50 case)', () => {
    expect(sameNumberMultiset(extractNumbers('total 50'), extractNumbers('المجموع ٧٦٧٦'))).toBe(false)
  })
  it('treats Latin and Arabic-Indic of the same value as equal', () => {
    expect(sameNumberMultiset(extractNumbers('50'), extractNumbers('٥٠'))).toBe(true)
  })
})

describe('isNumberOnly', () => {
  it('is true for digit-only segments', () => {
    expect(isNumberOnly('  50 ')).toBe(true)
    expect(isNumberOnly('٥٠')).toBe(true)
    expect(isNumberOnly('1,000.50')).toBe(true)
  })
  it('is false when letters are present', () => {
    expect(isNumberOnly('50 apples')).toBe(false)
  })
  it('is false for empty or punctuation-only', () => {
    expect(isNumberOnly('')).toBe(false)
    expect(isNumberOnly('--')).toBe(false)
  })
})
