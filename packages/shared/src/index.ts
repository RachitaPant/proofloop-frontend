// Contract between apps/api and apps/web. Input schemas are validated on the
// server and can be reused for client-side form validation; the interfaces
// describe the JSON the API returns.
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums. Each is exported as a Zod schema, a value object (Role.ADMIN) and a
// string-union type (Role).
// ---------------------------------------------------------------------------

export const RoleSchema = z.enum(['USER', 'REVIEWER', 'ADMIN']);
export const Role = RoleSchema.enum;
export type Role = z.infer<typeof RoleSchema>;

export const RequestStatusSchema = z.enum(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED']);
export const RequestStatus = RequestStatusSchema.enum;
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const ActionTypeSchema = z.enum(['APPROVED', 'REJECTED']);
export const ActionType = ActionTypeSchema.enum;
export type ActionType = z.infer<typeof ActionTypeSchema>;

/** What an audit entry records. People approve or reject; the AI copilot only ever advises. */
export const AI_RECOMMENDATION_ACTION = 'AI_RECOMMENDATION';
export type AuditAction = ActionType | typeof AI_RECOMMENDATION_ACTION;

export const ACTIVE_STATUSES: readonly RequestStatus[] = ['PENDING', 'IN_REVIEW'];

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

const requiredText = (message: string) => z.string({ error: message }).trim().min(1, message);

export const RegisterInput = z.object({
  name: requiredText('Name is required').max(100, 'Name is too long'),
  email: z.email('Email must be valid'),
  password: z.string({ error: 'Password is required' }).min(8, 'Password must be at least 8 characters').max(200),
  /** Join an existing organisation through an invite link... */
  inviteToken: z.string().min(20).max(200).nullish(),
  /** ...or name the new organisation this sign-up creates. */
  organizationName: z.string().trim().max(80, 'Organisation name is too long').nullish(),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.email('Email must be valid'),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginInput>;

// Fields a workflow collects on each request (e.g. amount, department).
// Step conditions route on these values.
export const FieldTypeSchema = z.enum(['number', 'text', 'select']);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const WorkflowFieldInput = z.object({
  key: z
    .string({ error: 'Field key is required' })
    .regex(/^[a-z][a-zA-Z0-9_]{0,39}$/, 'Field key must start with a lowercase letter and use only letters, digits or _'),
  label: requiredText('Field label is required').max(60, 'Field label is too long'),
  type: FieldTypeSchema,
  required: z.boolean().default(false),
  options: z.array(requiredText('Option cannot be empty').max(60)).max(20).nullish(),
});
export type WorkflowFieldInput = z.infer<typeof WorkflowFieldInput>;

export const ConditionOperatorSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']);
export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const ConditionRuleInput = z.object({
  field: requiredText('Condition field is required'),
  operator: ConditionOperatorSchema,
  value: z.union([z.number(), z.string().max(200), z.array(z.string().max(200)).min(1).max(20)]),
});
export type ConditionRule = z.infer<typeof ConditionRuleInput>;

export const StepConditionInput = z.object({
  mode: z.enum(['all', 'any']).default('all'),
  rules: z.array(ConditionRuleInput).min(1, 'A condition needs at least one rule').max(10),
});
export type StepCondition = z.infer<typeof StepConditionInput>;

export const WorkflowStepInput = z.object({
  stepIndex: z.number({ error: 'Step index is required' }).int().min(0),
  stepName: requiredText('Step name is required').max(100, 'Step name is too long'),
  /** Who may act: everyone with this role... */
  requiredRole: RoleSchema.nullish(),
  /** ...or the members of this approver group. Exactly one of the two is set. */
  approverGroupId: z.string().regex(/^[a-f0-9]{24}$/, 'Unknown approver group').nullish(),
  requiredApprovals: z.number().int().min(1, 'Required approvals must be at least 1').nullish(),
  slaHours: z.number().int().min(1, 'SLA hours must be at least 1 if specified').nullish(),
  /** Steps sharing a stage run in parallel. Defaults to the step's position (sequential). */
  stage: z.number().int().min(0).max(19).nullish(),
  /** The step only applies to requests whose fields satisfy this. */
  condition: StepConditionInput.nullish(),
});
export type WorkflowStepInput = z.infer<typeof WorkflowStepInput>;

const NUMERIC_OPERATORS: readonly ConditionOperator[] = ['gt', 'gte', 'lt', 'lte'];

export const CreateWorkflowInput = z
  .object({
    name: requiredText('Workflow name is required').max(100, 'Workflow name is too long'),
    description: z.string().max(2000, 'Description is too long').nullish(),
    fields: z.array(WorkflowFieldInput).max(20, 'A workflow can have at most 20 fields').default([]),
    steps: z
      .array(WorkflowStepInput, { error: 'Workflow must have at least one step' })
      .min(1, 'Workflow must have at least one step')
      .max(20, 'A workflow can have at most 20 steps'),
  })
  .superRefine((wf, ctx) => {
    const byKey = new Map<string, WorkflowFieldInput>();
    wf.fields.forEach((field, i) => {
      if (byKey.has(field.key)) {
        ctx.addIssue({ code: 'custom', path: ['fields', i, 'key'], message: `Duplicate field key "${field.key}"` });
      }
      byKey.set(field.key, field);
      if (field.type === 'select' && !field.options?.length) {
        ctx.addIssue({ code: 'custom', path: ['fields', i, 'options'], message: 'Select fields need at least one option' });
      }
    });

    wf.steps.forEach((step, i) => {
      if (!step.requiredRole === !step.approverGroupId) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'requiredRole'],
          message: 'Each step needs either a required role or an approver group (not both)',
        });
      }
      step.condition?.rules.forEach((rule, r) => {
        const path = ['steps', i, 'condition', 'rules', r];
        const field = byKey.get(rule.field);
        if (!field) {
          ctx.addIssue({ code: 'custom', path: [...path, 'field'], message: `Unknown field "${rule.field}"` });
          return;
        }
        const numeric = NUMERIC_OPERATORS.includes(rule.operator);
        if (numeric && field.type !== 'number') {
          ctx.addIssue({ code: 'custom', path: [...path, 'operator'], message: `"${rule.operator}" only works on number fields` });
        }
        if (numeric && typeof rule.value !== 'number') {
          ctx.addIssue({ code: 'custom', path: [...path, 'value'], message: 'Comparison value must be a number' });
        }
        if (rule.operator === 'contains' && field.type !== 'text') {
          ctx.addIssue({ code: 'custom', path: [...path, 'operator'], message: '"contains" only works on text fields' });
        }
        if (rule.operator === 'in' && !Array.isArray(rule.value)) {
          ctx.addIssue({ code: 'custom', path: [...path, 'value'], message: '"in" needs a list of values' });
        }
      });
    });
  });
/** Parsed workflow (defaults applied), as the API sees it. */
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInput>;
/** What a client sends. */
export type CreateWorkflowPayload = z.input<typeof CreateWorkflowInput>;

export const FieldValueSchema = z.union([z.number(), z.string().max(500)]);
export type FieldValue = z.infer<typeof FieldValueSchema>;

export const CreateRequestInput = z.object({
  title: requiredText('Title is required').max(200, 'Title is too long'),
  description: z.string().max(5000, 'Description is too long').nullish(),
  workflowId: requiredText('Workflow ID is required'),
  /** Values for the workflow's fields; checked against the workflow on the server. */
  fields: z.record(z.string(), FieldValueSchema).default({}),
});
export type CreateRequestInput = z.infer<typeof CreateRequestInput>;
export type CreateRequestPayload = z.input<typeof CreateRequestInput>;

export const RequestActionInput = z.object({
  comment: z.string().max(2000, 'Comment must be text under 2000 characters').nullish(),
  /** Which step to act on; only needed when the viewer can act on several parallel steps. */
  stepIndex: z.number().int().min(0).nullish(),
});
export type RequestActionInput = z.infer<typeof RequestActionInput>;

export const CreateDelegationInput = z.object({
  toEmail: z.email('Enter the email of the person to delegate to'),
  /** ISO date-time; when the delegation stops (at most 90 days ahead). */
  endsAt: z.iso.datetime({ offset: true, error: 'End date must be a valid date and time' }),
  note: z.string().max(200, 'Note is too long').nullish(),
});
export type CreateDelegationInput = z.infer<typeof CreateDelegationInput>;

// Named sets of users (e.g. "Finance team") that workflow steps can be assigned to.
export const ApproverGroupInput = z.object({
  name: requiredText('Group name is required').max(60, 'Group name is too long'),
  description: z.string().max(300, 'Description is too long').nullish(),
  memberIds: z.array(z.string().regex(/^[a-f0-9]{24}$/, 'Unknown user')).max(200, 'A group can have at most 200 members').default([]),
});
export type ApproverGroupInput = z.infer<typeof ApproverGroupInput>;
export type ApproverGroupPayload = z.input<typeof ApproverGroupInput>;

// AI-assisted workflow drafting: describe a process in plain English, get a
// draft workflow to review. The draft is never saved by the AI endpoint.
export const AiWorkflowDraftInput = z.object({
  prompt: z
    .string({ error: 'Describe the workflow you want' })
    .trim()
    .min(10, 'Describe the workflow in a bit more detail')
    .max(2000, 'Keep the description under 2000 characters'),
});
export type AiWorkflowDraftInput = z.infer<typeof AiWorkflowDraftInput>;

export const CreateInviteInput = z.object({
  role: RoleSchema.default('USER'),
  /** Optional: only this address may use the invite. */
  email: z.email('Email must be valid').nullish(),
});
export type CreateInviteInput = z.infer<typeof CreateInviteInput>;
export type CreateInvitePayload = z.input<typeof CreateInviteInput>;

export const UpdateOrganizationInput = z.object({
  name: requiredText('Organisation name is required').max(80, 'Organisation name is too long'),
});
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInput>;

export const UpdateRoleInput = z.object({
  role: RoleSchema,
});
export type UpdateRoleInput = z.infer<typeof UpdateRoleInput>;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
  /** The user's role inside their organisation. */
  role: Role;
  orgId?: string;
  createdAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export interface Invite {
  id: string;
  role: Role;
  email?: string | null;
  createdByName: string;
  expiresAt: string;
  createdAt: string;
}

/** Returned once, when an invite is created: the only time the link exists. */
export interface CreatedInvite extends Invite {
  token: string;
}

/** What the join page shows before sign-up. */
export interface InvitePreview {
  valid: boolean;
  orgName?: string;
  role?: Role;
  email?: string | null;
}

export interface AuthResponse {
  token: string;
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface WorkflowField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[] | null;
}

export interface WorkflowStep {
  stepIndex: number;
  stepName: string;
  /** Set for role-based steps. */
  requiredRole?: Role | null;
  /** Set for group-based steps (with the group's name at save time, for display). */
  approverGroupId?: string | null;
  approverGroupName?: string | null;
  requiredApprovals: number;
  slaHours?: number | null;
  /** Steps with the same stage run in parallel; stages run in order. */
  stage: number;
  condition?: StepCondition | null;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string | null;
  createdBy: string;
  fields: WorkflowField[];
  steps: WorkflowStep[];
  createdAt: string;
}

export type AiRecommendationKind = 'approve' | 'reject' | 'needs_more_info';
export type AiConfidence = 'low' | 'medium' | 'high';
export type AiCheckResult = 'pass' | 'warn' | 'fail' | 'info';

/** What the reviewer copilot concluded. Stored in the audit entry and covered by its hash. */
export interface AiRecommendation {
  model: string;
  /** Version of the prompt that produced it, so results can be traced to wording. */
  promptVersion: string;
  /** The person who asked for the review. */
  requestedBy: string;
  requestedByName: string;
  /** How many audit entries existed when the model looked; later entries it didn't see. */
  basedOnEntries: number;
  summary: string;
  checks: { name: string; result: AiCheckResult; detail: string }[];
  concerns: string[];
  missingInformation: string[];
  recommendation: AiRecommendationKind;
  confidence: AiConfidence;
  rationale: string;
}

export interface RequestAction {
  stepIndex: number;
  /** AI_RECOMMENDATION entries are advice only: they never change a request's status or routing. */
  action: AuditAction;
  /** Present on AI_RECOMMENDATION entries; actedBy is then `ai:<model>`. */
  ai?: AiRecommendation | null;
  actedBy: string;
  actedByName: string;
  /** Set when a delegate acted for someone else. */
  onBehalfOf?: string | null;
  onBehalfOfName?: string | null;
  comment?: string | null;
  timestamp: string;
  previousHash: string;
  currentHash: string;
}

/** A step the current viewer may approve or reject right now. */
export interface ActionableStep {
  stepIndex: number;
  /** Present when the viewer would act as someone's delegate. */
  onBehalfOf?: { id: string; name: string } | null;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description?: string | null;
  workflowId: string;
  workflowName: string;
  createdBy: string;
  createdByName: string;
  /** Index of the current stage (equals the step index for sequential workflows). */
  currentStep: number;
  status: RequestStatus;
  history: RequestAction[];
  createdAt: string;
  updatedAt: string;
  /** Values for the workflow's fields. */
  fields: Record<string, FieldValue>;
  /** Steps whose condition didn't match this request's fields; decided at creation. */
  skippedSteps: number[];
  /** step index → ids of users who approved that step */
  stepApprovals: Record<string, string[]>;
  /** step index → ISO time the step became current */
  stepStartTimes: Record<string, string>;
  /** Steps rerouted to ADMIN after missing their SLA. */
  escalatedSteps: number[];
  /** True while any step in the current stage is escalated. */
  escalated: boolean;
  originalRequiredRole?: Role | null;
  /** Only on single-request reads: what the viewer can act on. */
  actionableSteps?: ActionableStep[];
}

export interface ApproverGroup {
  id: string;
  name: string;
  description?: string | null;
  memberIds: string[];
  /** Resolved for display. */
  members: { id: string; name: string; email: string }[];
  createdAt: string;
}

/** What the AI produced, ready to load into the workflow builder. */
export interface AiWorkflowDraft {
  /** Same shape the builder submits; validated against CreateWorkflowInput. */
  workflow: CreateWorkflowPayload;
  /** Assumptions the model made, for the human to check. */
  notes: string[];
  model: string;
  /** Requests left in this hour's allowance. */
  remainingThisHour: number;
}

export interface AiReviewResult {
  /** The audit entry that was appended (its `ai` field holds the review). */
  entry: RequestAction;
  /** Requests left in this hour's allowance. */
  remainingThisHour: number;
}

export interface AiStatus {
  enabled: boolean;
}

export interface Delegation {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  /** The delegator's role, which the delegate may approve as. */
  role: Role;
  startsAt: string;
  endsAt: string;
  revokedAt?: string | null;
  note?: string | null;
  active: boolean;
}

export interface MyDelegations {
  given: Delegation[];
  received: Delegation[];
}

export interface ChainVerification {
  valid: boolean;
  length: number;
  headHash?: string;
  brokenAtIndex?: number;
  reason?: string;
}

export interface Analytics {
  totalRequests: number;
  pendingRequests: number;
  inReviewRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  totalWorkflows: number;
  totalUsers: number;
}

/** Error envelope for 4xx/5xx responses (except validation errors). */
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
}

/** 400 validation errors: a flat { field: message } map. */
export type ValidationErrors = Record<string, string>;

export * from './engine';
