import { describe, expect, it } from 'vitest';
import { reviewActionEnabled } from './reviewActions';

describe('reviewActionEnabled', () => {
  describe('APPROVE', () => {
    it('is enabled with an empty body for a non-author', () => {
      expect(reviewActionEnabled('APPROVE', '', false)).toBe(true);
    });
    it('is enabled with a body for a non-author', () => {
      expect(reviewActionEnabled('APPROVE', 'lgtm', false)).toBe(true);
    });
    it('is disabled when the viewer authored the PR', () => {
      expect(reviewActionEnabled('APPROVE', 'lgtm', true)).toBe(false);
    });
  });

  describe('REQUEST_CHANGES', () => {
    it('is disabled with an empty body', () => {
      expect(reviewActionEnabled('REQUEST_CHANGES', '', false)).toBe(false);
    });
    it('is disabled with a whitespace-only body', () => {
      expect(reviewActionEnabled('REQUEST_CHANGES', '   \n', false)).toBe(false);
    });
    it('is enabled with a real body for a non-author', () => {
      expect(reviewActionEnabled('REQUEST_CHANGES', 'fix this', false)).toBe(true);
    });
    it('is disabled when the viewer authored the PR even with a body', () => {
      expect(reviewActionEnabled('REQUEST_CHANGES', 'fix this', true)).toBe(false);
    });
  });

  describe('COMMENT', () => {
    it('is disabled with an empty body', () => {
      expect(reviewActionEnabled('COMMENT', '', false)).toBe(false);
    });
    it('is enabled with a body for a non-author', () => {
      expect(reviewActionEnabled('COMMENT', 'a note', false)).toBe(true);
    });
    it('is enabled with a body even when the viewer authored the PR', () => {
      expect(reviewActionEnabled('COMMENT', 'a note', true)).toBe(true);
    });
  });
});
