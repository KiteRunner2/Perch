const JIRA_KEY_PATTERN = /(?:^|[^A-Z0-9])(KRIT-\d+)(?![A-Z0-9])/i;

export const JIRA_BROWSE_URL = 'https://kritik.atlassian.net/browse';

/** Return the first Kritik Jira key found in the supplied values. */
export function findJiraTicketKey(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const match = value?.match(JIRA_KEY_PATTERN);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

export function jiraTicketUrl(key: string): string {
  return `${JIRA_BROWSE_URL}/${key}`;
}
