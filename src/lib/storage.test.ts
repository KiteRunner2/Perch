import { afterEach, describe, expect, it } from 'vitest';
import {
  clampDiffFontSize,
  diffLineHeight,
  DIFF_FONT_DEFAULT,
  DIFF_FONT_MAX,
  DIFF_FONT_MIN,
  redactToken,
  storage,
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

describe('commit sort preference', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  afterEach(() => {
    if (originalStorage) {
      Object.defineProperty(globalThis, 'localStorage', originalStorage);
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  function stubStorage(initial?: string): Map<string, string> {
    const values = new Map<string, string>();
    if (initial != null) values.set('perch.commits.sortOrder', initial);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        get length() {
          return values.size;
        },
      } satisfies Storage,
    });
    return values;
  }

  it('defaults malformed and missing values to newest', () => {
    stubStorage('sideways');
    expect(storage.getCommitSortOrder()).toBe('newest');

    stubStorage();
    expect(storage.getCommitSortOrder()).toBe('newest');
  });

  it('persists and restores either supported order', () => {
    const values = stubStorage();
    storage.setCommitSortOrder('oldest');
    expect(values.get('perch.commits.sortOrder')).toBe('oldest');
    expect(storage.getCommitSortOrder()).toBe('oldest');

    storage.setCommitSortOrder('newest');
    expect(storage.getCommitSortOrder()).toBe('newest');
  });
});
