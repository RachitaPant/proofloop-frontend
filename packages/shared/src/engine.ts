// Pure routing rules for workflows, shared by the API (which enforces them)
// and the web app (which previews them while you build a workflow or fill in
// a request). No I/O, no eval: conditions are data, compared with a fixed set
// of operators.
import type { ConditionRule, FieldValue, StepCondition, WorkflowFieldInput } from './index';

type FieldDef = Pick<WorkflowFieldInput, 'key' | 'label' | 'type' | 'required' | 'options'>;
type StepLike = { stage?: number | null; condition?: StepCondition | null };

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/** A rule on a missing value is false, whatever the operator. */
export function evaluateRule(rule: ConditionRule, values: Record<string, FieldValue | undefined>): boolean {
  const actual = values[rule.field];
  if (actual === undefined || actual === null || actual === '') return false;

  switch (rule.operator) {
    case 'eq':
      return String(actual) === String(rule.value);
    case 'neq':
      return String(actual) !== String(rule.value);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = Number(actual);
      const b = Number(rule.value);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      if (rule.operator === 'gt') return a > b;
      if (rule.operator === 'gte') return a >= b;
      if (rule.operator === 'lt') return a < b;
      return a <= b;
    }
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(String(actual));
    case 'contains':
      return String(actual).toLowerCase().includes(String(rule.value).toLowerCase());
  }
}

/** No condition means the step always applies. */
export function evaluateCondition(
  condition: StepCondition | null | undefined,
  values: Record<string, FieldValue | undefined>,
): boolean {
  if (!condition || condition.rules.length === 0) return true;
  const results = condition.rules.map((rule) => evaluateRule(rule, values));
  return condition.mode === 'any' ? results.some(Boolean) : results.every(Boolean);
}

const OPERATOR_LABELS: Record<ConditionRule['operator'], string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'is one of',
  contains: 'contains',
};

/** Human-readable condition, e.g. "amount > 100000 and department is one of Finance, Legal". */
export function describeCondition(condition: StepCondition | null | undefined, fields: FieldDef[] = []): string {
  if (!condition || condition.rules.length === 0) return 'Always';
  const label = (key: string) => fields.find((f) => f.key === key)?.label ?? key;
  return condition.rules
    .map((r) => `${label(r.field)} ${OPERATOR_LABELS[r.operator]} ${Array.isArray(r.value) ? r.value.join(', ') : r.value}`)
    .join(condition.mode === 'any' ? ' or ' : ' and ');
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

/** A step's stage; steps saved before stages existed run one per stage. */
export function stageOf(step: StepLike, index: number): number {
  return step.stage ?? index;
}

/**
 * Renumbers stages to 0..n-1 in order of first appearance and orders steps by
 * stage (stable), so a workflow's stages are always contiguous.
 */
export function normalizeStages<T extends StepLike>(steps: T[]): (T & { stage: number })[] {
  const order = [...new Set(steps.map((s, i) => stageOf(s, i)))].sort((a, b) => a - b);
  const remap = new Map(order.map((stage, i) => [stage, i]));
  return steps
    .map((step, i) => ({ ...step, stage: remap.get(stageOf(step, i))! }))
    .map((step, i) => ({ step, i }))
    .sort((a, b) => a.step.stage - b.step.stage || a.i - b.i)
    .map(({ step }) => step);
}

export function stageCount(steps: StepLike[]): number {
  return steps.reduce((max, s, i) => Math.max(max, stageOf(s, i) + 1), 0);
}

/** Indices of the steps in a stage. */
export function stepsInStage(steps: StepLike[], stage: number): number[] {
  return steps.flatMap((s, i) => (stageOf(s, i) === stage ? [i] : []));
}

/** Steps whose condition doesn't match the request's field values. */
export function planSkippedSteps(steps: StepLike[], values: Record<string, FieldValue | undefined>): number[] {
  return steps.flatMap((s, i) => (evaluateCondition(s.condition, values) ? [] : [i]));
}

/** The first stage at or after `from` that has at least one step that applies, or -1. */
export function nextActiveStage(steps: StepLike[], skipped: number[], from: number): number {
  for (let stage = from; stage < stageCount(steps); stage++) {
    if (stepsInStage(steps, stage).some((i) => !skipped.includes(i))) return stage;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Request field values
// ---------------------------------------------------------------------------

/**
 * Checks submitted values against a workflow's field definitions: required
 * fields present, numbers numeric, selects one of their options. Unknown keys
 * are dropped and numeric strings become numbers.
 */
export function validateFieldValues(
  defs: FieldDef[],
  raw: Record<string, unknown>,
): { values: Record<string, FieldValue>; errors: Record<string, string> } {
  const values: Record<string, FieldValue> = {};
  const errors: Record<string, string> = {};

  for (const def of defs) {
    const input = raw[def.key];
    const empty = input === undefined || input === null || (typeof input === 'string' && input.trim() === '');
    if (empty) {
      if (def.required) errors[def.key] = `${def.label} is required`;
      continue;
    }

    if (def.type === 'number') {
      const n = typeof input === 'number' ? input : Number(String(input).trim());
      if (!Number.isFinite(n)) errors[def.key] = `${def.label} must be a number`;
      else values[def.key] = n;
    } else {
      const text = String(input).trim();
      if (def.type === 'select' && !def.options?.includes(text)) {
        errors[def.key] = `${def.label} must be one of: ${def.options?.join(', ')}`;
      } else if (text.length > 500) {
        errors[def.key] = `${def.label} is too long`;
      } else {
        values[def.key] = text;
      }
    }
  }

  return { values, errors };
}

// ---------------------------------------------------------------------------
// Field keys
// ---------------------------------------------------------------------------

/**
 * Turns a label into a field key ("Cost centre (EUR)" → "costCentreEur"),
 * unique within `taken` (which is updated). Used by the workflow builder and
 * by the AI draft generator so both produce the same keys.
 */
export function fieldKeyFromLabel(label: string, taken: Set<string>): string {
  const words = label.toLowerCase().match(/[a-z0-9]+/g) ?? ['field'];
  let key = words.map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1))).join('');
  if (!/^[a-z]/.test(key)) key = `f${key}`;
  key = key.slice(0, 40);
  let unique = key;
  for (let n = 2; taken.has(unique); n++) unique = `${key}${n}`;
  taken.add(unique);
  return unique;
}
