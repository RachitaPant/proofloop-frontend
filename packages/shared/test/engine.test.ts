import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  CreateWorkflowInput,
  describeCondition,
  evaluateCondition,
  evaluateRule,
  nextActiveStage,
  normalizeStages,
  planSkippedSteps,
  stageCount,
  stepsInStage,
  validateFieldValues,
  type StepCondition,
} from '../src';

describe('evaluateRule', () => {
  const values = { amount: 150000, department: 'Finance', notes: 'Urgent laptop refresh' };

  test('numeric comparisons', () => {
    assert.equal(evaluateRule({ field: 'amount', operator: 'gt', value: 100000 }, values), true);
    assert.equal(evaluateRule({ field: 'amount', operator: 'gte', value: 150000 }, values), true);
    assert.equal(evaluateRule({ field: 'amount', operator: 'lt', value: 150000 }, values), false);
    assert.equal(evaluateRule({ field: 'amount', operator: 'lte', value: 150000 }, values), true);
  });

  test('equality, membership and text search', () => {
    assert.equal(evaluateRule({ field: 'department', operator: 'eq', value: 'Finance' }, values), true);
    assert.equal(evaluateRule({ field: 'department', operator: 'neq', value: 'Finance' }, values), false);
    assert.equal(evaluateRule({ field: 'department', operator: 'in', value: ['Legal', 'Finance'] }, values), true);
    assert.equal(evaluateRule({ field: 'notes', operator: 'contains', value: 'URGENT' }, values), true);
  });

  test('a rule on a missing or non-numeric value is false', () => {
    assert.equal(evaluateRule({ field: 'missing', operator: 'neq', value: 'x' }, values), false);
    assert.equal(evaluateRule({ field: 'department', operator: 'gt', value: 1 }, values), false);
    assert.equal(evaluateRule({ field: 'amount', operator: 'gt', value: 1 }, { amount: '' }), false);
  });
});

describe('evaluateCondition', () => {
  const big: StepCondition = {
    mode: 'all',
    rules: [
      { field: 'amount', operator: 'gt', value: 100000 },
      { field: 'department', operator: 'eq', value: 'Finance' },
    ],
  };

  test('all vs any', () => {
    assert.equal(evaluateCondition(big, { amount: 200000, department: 'Finance' }), true);
    assert.equal(evaluateCondition(big, { amount: 200000, department: 'Legal' }), false);
    assert.equal(evaluateCondition({ ...big, mode: 'any' }, { amount: 200000, department: 'Legal' }), true);
  });

  test('no condition always applies', () => {
    assert.equal(evaluateCondition(null, {}), true);
    assert.equal(evaluateCondition(undefined, {}), true);
  });

  test('describeCondition is readable', () => {
    const fields = [{ key: 'amount', label: 'Amount', type: 'number' as const, required: true }];
    assert.equal(describeCondition(big, fields), 'Amount > 100000 and department = Finance');
    assert.equal(describeCondition(null), 'Always');
  });
});

describe('stages', () => {
  // Manager → (Legal ∥ Security) → CFO (only for big amounts)
  const steps = [
    { stage: 0 },
    { stage: 1 },
    { stage: 1 },
    { stage: 2, condition: { mode: 'all' as const, rules: [{ field: 'amount', operator: 'gt' as const, value: 100000 }] } },
  ];

  test('legacy steps without a stage run sequentially', () => {
    const legacy = [{}, {}, {}];
    assert.equal(stageCount(legacy), 3);
    assert.deepEqual(stepsInStage(legacy, 1), [1]);
  });

  test('parallel steps share a stage', () => {
    assert.equal(stageCount(steps), 3);
    assert.deepEqual(stepsInStage(steps, 1), [1, 2]);
  });

  test('normalizeStages makes stages contiguous and ordered, keeping order within a stage', () => {
    const messy = [
      { name: 'c', stage: 7 },
      { name: 'a', stage: 2 },
      { name: 'b', stage: 2 },
    ];
    assert.deepEqual(
      normalizeStages(messy).map((s) => [s.name, s.stage]),
      [
        ['a', 0],
        ['b', 0],
        ['c', 1],
      ],
    );
  });

  test('conditional steps are skipped and empty stages are passed over', () => {
    const small = planSkippedSteps(steps, { amount: 5000 });
    assert.deepEqual(small, [3]);
    assert.equal(nextActiveStage(steps, small, 2), -1);
    assert.equal(nextActiveStage(steps, planSkippedSteps(steps, { amount: 500000 }), 2), 2);
    assert.equal(nextActiveStage(steps, [0], 0), 1);
  });
});

describe('validateFieldValues', () => {
  const defs = [
    { key: 'amount', label: 'Amount', type: 'number' as const, required: true },
    { key: 'department', label: 'Department', type: 'select' as const, required: false, options: ['Finance', 'Legal'] },
    { key: 'notes', label: 'Notes', type: 'text' as const, required: false },
  ];

  test('coerces numbers, drops unknown keys, skips empty optionals', () => {
    const { values, errors } = validateFieldValues(defs, { amount: ' 1200 ', department: 'Legal', notes: '', evil: 'x' });
    assert.deepEqual(errors, {});
    assert.deepEqual(values, { amount: 1200, department: 'Legal' });
  });

  test('reports missing, non-numeric and off-list values', () => {
    assert.deepEqual(validateFieldValues(defs, {}).errors, { amount: 'Amount is required' });
    assert.equal(validateFieldValues(defs, { amount: 'lots' }).errors.amount, 'Amount must be a number');
    assert.match(validateFieldValues(defs, { amount: 1, department: 'HR' }).errors.department!, /one of: Finance, Legal/);
  });
});

describe('CreateWorkflowInput', () => {
  const base = {
    name: 'Purchase',
    fields: [{ key: 'amount', label: 'Amount', type: 'number' }],
    steps: [{ stepIndex: 0, stepName: 'Manager', requiredRole: 'REVIEWER' }],
  };

  test('accepts a valid conditional step', () => {
    const parsed = CreateWorkflowInput.safeParse({
      ...base,
      steps: [{ ...base.steps[0], condition: { rules: [{ field: 'amount', operator: 'gt', value: 100 }] } }],
    });
    assert.equal(parsed.success, true);
  });

  test('rejects conditions on unknown fields or mismatched operators', () => {
    const unknown = CreateWorkflowInput.safeParse({
      ...base,
      steps: [{ ...base.steps[0], condition: { rules: [{ field: 'nope', operator: 'eq', value: 'x' }] } }],
    });
    assert.equal(unknown.success, false);

    const textField = CreateWorkflowInput.safeParse({
      ...base,
      fields: [{ key: 'dept', label: 'Dept', type: 'text' }],
      steps: [{ ...base.steps[0], condition: { rules: [{ field: 'dept', operator: 'gt', value: 3 }] } }],
    });
    assert.equal(textField.success, false);
  });

  test('rejects duplicate keys and option-less selects', () => {
    const dup = CreateWorkflowInput.safeParse({
      ...base,
      fields: [
        { key: 'amount', label: 'A', type: 'number' },
        { key: 'amount', label: 'B', type: 'number' },
      ],
    });
    assert.equal(dup.success, false);
    const select = CreateWorkflowInput.safeParse({ ...base, fields: [{ key: 'dept', label: 'Dept', type: 'select' }] });
    assert.equal(select.success, false);
  });
});
