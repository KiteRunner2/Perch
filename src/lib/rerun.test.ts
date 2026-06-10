import { describe, expect, it } from 'vitest';
import { planRerun, type GhWorkflowRun } from './rerun';

function run(
  id: number,
  workflowId: number,
  status: string,
  name = `wf-${workflowId}`
): GhWorkflowRun {
  return { id, workflow_id: workflowId, status, name };
}

describe('planRerun', () => {
  it('returns an empty plan for no runs', () => {
    expect(planRerun([])).toEqual({ targets: [], inProgress: [] });
  });

  it('targets the latest completed run of each workflow', () => {
    const plan = planRerun([
      run(10, 1, 'completed', 'ci'),
      run(11, 2, 'completed', 'deploy'),
    ]);
    expect(plan.targets.map((r) => r.id).sort()).toEqual([10, 11]);
    expect(plan.inProgress).toEqual([]);
  });

  it('keeps only the latest run per workflow', () => {
    const plan = planRerun([
      run(10, 1, 'completed'),
      run(15, 1, 'completed'), // re-run of the same workflow — newer wins
      run(12, 1, 'completed'),
    ]);
    expect(plan.targets).toHaveLength(1);
    expect(plan.targets[0]!.id).toBe(15);
  });

  it('order of the input list does not matter', () => {
    const plan = planRerun([run(15, 1, 'completed'), run(10, 1, 'completed')]);
    expect(plan.targets[0]!.id).toBe(15);
  });

  it('skips workflows whose latest run is still in progress', () => {
    const plan = planRerun([
      run(10, 1, 'completed'),
      run(20, 2, 'in_progress'),
      run(30, 3, 'queued'),
    ]);
    expect(plan.targets.map((r) => r.id)).toEqual([10]);
    expect(plan.inProgress.map((r) => r.id).sort()).toEqual([20, 30]);
  });

  it('does not target an older completed run when a newer one is running', () => {
    // Workflow 1 finished once, then someone re-ran it and it's still
    // going — there's nothing to do for that workflow.
    const plan = planRerun([
      run(10, 1, 'completed'),
      run(20, 1, 'in_progress'),
    ]);
    expect(plan.targets).toEqual([]);
    expect(plan.inProgress.map((r) => r.id)).toEqual([20]);
  });
});
