import { describe, expect, it } from 'vitest';
import { findJiraTicketKey, jiraTicketUrl } from './jira';

describe('findJiraTicketKey', () => {
  it('finds and normalizes a ticket key in a branch name', () => {
    expect(findJiraTicketKey('feature/krit-1431-discard-draft')).toBe('KRIT-1431');
  });

  it('uses the first supplied source containing a ticket key', () => {
    expect(
      findJiraTicketKey(
        'feature/KRIT-1431-discard-draft',
        'KRIT-1460 Add attachment drawer',
        'Resolves KRIT-1314'
      )
    ).toBe('KRIT-1431');
  });

  it('falls back across missing and unmatched sources', () => {
    expect(findJiraTicketKey(null, 'Add attachment drawer', 'Resolves KRIT-1460.')).toBe(
      'KRIT-1460'
    );
  });

  it('ignores other projects and keys embedded in words', () => {
    expect(findJiraTicketKey('feature/VAI-1126', 'Fix XKRIT-123abc')).toBeNull();
  });
});

describe('jiraTicketUrl', () => {
  it('builds the Kritik Jira browse URL', () => {
    expect(jiraTicketUrl('KRIT-1431')).toBe(
      'https://kritik.atlassian.net/browse/KRIT-1431'
    );
  });
});
