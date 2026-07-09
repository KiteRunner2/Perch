import { describe, expect, it } from 'vitest';
import {
  clampDiffFontSize,
  diffLineHeight,
  DIFF_FONT_DEFAULT,
  DIFF_FONT_MAX,
  DIFF_FONT_MIN,
  redactToken,
} from './storage';

describe('clampDiffFontSize', () => {
  it('passes through sizes inside the range', () => {
    expect(clampDiffFontSize(13)).toBe(13);
    expect(clampDiffFontSize(DIFF_FONT_MIN)).toBe(DIFF_FONT_MIN);
    expect(clampDiffFontSize(DIFF_FONT_MAX)).toBe(DIFF_FONT_MAX);
  });

  it('clamps at both ends rather than wrapping', () => {
    expect(clampDiffFontSize(DIFF_FONT_MIN - 5)).toBe(DIFF_FONT_MIN);
    expect(clampDiffFontSize(DIFF_FONT_MAX + 5)).toBe(DIFF_FONT_MAX);
  });

  it('rounds fractional sizes', () => {
    expect(clampDiffFontSize(12.4)).toBe(12);
    expect(clampDiffFontSize(12.6)).toBe(13);
  });

  // A corrupted localStorage value must not render the diff at NaN px.
  it('falls back to the default for non-finite input', () => {
    expect(clampDiffFontSize(Number.NaN)).toBe(DIFF_FONT_DEFAULT);
    expect(clampDiffFontSize(Number.POSITIVE_INFINITY)).toBe(DIFF_FONT_DEFAULT);
  });
});

describe('diffLineHeight', () => {
  it('keeps the shipped 11.5/18-ish rhythm as type scales', () => {
    expect(diffLineHeight(11)).toBe(19);
    expect(diffLineHeight(13)).toBe(21);
    expect(diffLineHeight(16)).toBe(24);
  });

  it('stays strictly greater than the font size at every step', () => {
    for (let s = DIFF_FONT_MIN; s <= DIFF_FONT_MAX; s++) {
      expect(diffLineHeight(s)).toBeGreaterThan(s);
    }
  });
});

describe('redactToken', () => {
  it('keeps only the head and tail of a long token', () => {
    expect(redactToken('ghp_abcdefghijklmnop')).toBe('ghp_…mnop');
  });

  it('fully masks short tokens and returns empty for none', () => {
    expect(redactToken('short')).toBe('••••');
    expect(redactToken('')).toBe('');
  });
});
