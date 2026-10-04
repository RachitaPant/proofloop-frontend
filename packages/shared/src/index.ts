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

export const ACTIVE_STATUSES: readonly RequestStatus[] = ['PENDING', 'IN_REVIEW'];

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

const requiredText = (message: string) => z.string({ error: message }).trim().min(1, message);

export const RegisterInput = z.object({
  name: requiredText('Name is required').max(100, 'Name is too long'),
  email: z.email('Email must be valid'),
  password: z.string({ error: 'Password is required' }).min(8, 'Password must be at least 8 characters').max(200),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.email('Email must be valid'),
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const WorkflowStepInput = z.object({
  stepIndex: z.number({ error: 'Step index is required' }).int().min(0),
  stepName: requiredText('Step name is required').max(100, 'Step name is too long'),
  requiredRole: RoleSchema,
  requiredApprovals: z.number().int().min(1, 'Required approvals must be at least 1').nullish(),
  slaHours: z.number().int().min(1, 'SLA hours must be at least 1 if specified').nullish(),
});
export type WorkflowStepInput = z.infer<typeof WorkflowStepInput>;

export const CreateWorkflowInput = z.object({
  name: requiredText('Workflow name is required').max(100, 'Workflow name is too long'),
  description: z.string().max(2000, 'Description is too long').nullish(),
  steps: z.array(WorkflowStepInput, { error: 'Workflow must have at least one step' }).min(1, 'Workflow must have at least one step').max(20, 'A workflow can have at most 20 steps'),
});
export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInput>;

export const CreateRequestInput = z.object({
  title: requiredText('Title is required').max(200, 'Title is too long'),
  description: z.string().max(5000, 'Description is too long').nullish(),
  workflowId: requiredText('Workflow ID is required'),
});
export type CreateRequestInput = z.infer<typeof CreateRequestInput>;

export const RequestActionInput = z.object({
  comment: z.string().max(2000, 'Comment must be text under 2000 characters').nullish(),
});
export type RequestActionInput = z.infer<typeof RequestActionInput>;

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
  role: Role;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface WorkflowStep {
  stepIndex: number;
  stepName: string;
  requiredRole: Role;
  requiredApprovals: number;
  slaHours?: number | null;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string | null;
  createdBy: string;
  steps: WorkflowStep[];
  createdAt: string;
}

export interface RequestAction {
  stepIndex: number;
  action: ActionType;
  actedBy: string;
  actedByName: string;
  comment?: string | null;
  timestamp: string;
  previousHash: string;
  currentHash: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description?: string | null;
  workflowId: string;
  workflowName: string;
  createdBy: string;
  createdByName: string;
  currentStep: number;
  status: RequestStatus;
  history: RequestAction[];
  createdAt: string;
  updatedAt: string;
  /** step index → ids of users who approved that step */
  stepApprovals: Record<string, string[]>;
  /** step index → ISO time the step became current */
  stepStartTimes: Record<string, string>;
  escalated: boolean;
  originalRequiredRole?: Role | null;
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
