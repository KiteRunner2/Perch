/**
 * Re-run a PR's CI pipeline via the GitHub Actions REST API.
 *
 * There is no single "re-run everything for this PR" endpoint, so we
 * list the workflow runs for the PR's head SHA and POST a rerun for
 * the latest run of each workflow. Re-run works on green runs too —
 * the primary use case is reviving branch sandboxes that get torn
 * down nightly, not retrying failures. GraphQL has no mutation for
 * this, hence REST (same PAT, same pattern as the Diff tab).
 */

/** Shape of one entry in GitHub's `GET /actions/runs` response. */
export interface GhWorkflowRun {
  id: number;
  name: string | null;
  /** Id of the workflow (the .yml) this run belongs to. */
  workflow_id: number;
  /** `queued` | `in_progress` | `completed` | a few rarer states. */
  status: string;
}

export interface RerunPlan {
  /** Latest run per workflow that is completed — these get re-run. */
  targets: GhWorkflowRun[];
  /**
   * Latest runs still queued / in progress. GitHub rejects re-run on
   * unfinished runs (403), so we skip them — they're already running,
   * which for the sandbox-revival use case is the desired end state.
   */
  inProgress: GhWorkflowRun[];
}

/**
 * Decide which runs to re-run. A head SHA can accumulate several runs
 * per workflow (previous re-runs, partial retries); only the latest
 * one per workflow is what GitHub's own "Re-run all jobs" acts on.
 * Run ids are monotonically increasing, so "latest" = highest id.
 */
export function planRerun(runs: GhWorkflowRun[]): RerunPlan {
  const latestByWorkflow = new Map<number, GhWorkflowRun>();
  for (const run of runs) {
    const prev = latestByWorkflow.get(run.workflow_id);
    if (!prev || run.id > prev.id) latestByWorkflow.set(run.workflow_id, run);
  }

  const targets: GhWorkflowRun[] = [];
  const inProgress: GhWorkflowRun[] = [];
  for (const run of latestByWorkflow.values()) {
    if (run.status === 'completed') targets.push(run);
    else inProgress.push(run);
  }
  return { targets, inProgress };
}

export interface RerunResult {
  /** How many workflow runs were re-triggered. */
  started: number;
  /** How many were skipped because they're already running. */
  skippedInProgress: number;
}

const REST_HEADERS = (token: string): HeadersInit => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'perch-dashboard',
});

async function restError(res: Response, context: string): Promise<Error> {
  const body = await res.text().catch(() => '');
  return new Error(
    `GitHub ${context}: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`
  );
}

/**
 * Re-run the whole pipeline for a PR's head commit. Throws when the
 * SHA has no runs at all (e.g. a fork PR whose runs live in the fork,
 * or CI that isn't GitHub Actions) and on any failed re-run request —
 * a common 403 is a run past GitHub's 30-day re-run window.
 */
export async function rerunPipeline(
  token: string,
  repoNameWithOwner: string,
  headSha: string
): Promise<RerunResult> {
  const listUrl = `https://api.github.com/repos/${repoNameWithOwner}/actions/runs?head_sha=${encodeURIComponent(headSha)}&per_page=100`;
  const listRes = await fetch(listUrl, { headers: REST_HEADERS(token) });
  if (!listRes.ok) throw await restError(listRes, 'actions/runs');
  const json = (await listRes.json()) as { workflow_runs: GhWorkflowRun[] };

  const { targets, inProgress } = planRerun(json.workflow_runs ?? []);
  if (targets.length === 0 && inProgress.length === 0) {
    throw new Error(
      'No workflow runs found for the latest commit — the pipeline may not be GitHub Actions, or runs may live in a fork.'
    );
  }

  // Sequential on purpose: if one re-run fails (30-day window, scopes),
  // we stop and surface it instead of spraying half-failed requests.
  for (const run of targets) {
    const res = await fetch(
      `https://api.github.com/repos/${repoNameWithOwner}/actions/runs/${run.id}/rerun`,
      { method: 'POST', headers: REST_HEADERS(token) }
    );
    if (!res.ok) {
      throw await restError(res, `re-run of "${run.name ?? run.id}"`);
    }
  }

  return { started: targets.length, skippedInProgress: inProgress.length };
}
