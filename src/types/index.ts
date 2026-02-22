export enum Role {
  USER = "USER",
  REVIEWER = "REVIEWER",
  ADMIN = "ADMIN",
}

export enum RequestStatus {
  PENDING = "PENDING",
  IN_REVIEW = "IN_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ActionType {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
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
  requiredApprovals: number; // NEW
  slaHours?: number; // NEW
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  steps: WorkflowStep[];
  createdAt: string;
}

export interface RequestAction {
  stepIndex: number;
  action: ActionType;
  actedBy: string;
  actedByName: string;
  comment?: string;
  timestamp: string;
  previousHash: string; // NEW
  currentHash: string; // NEW
}

export interface Request {
  id: string;
  title: string;
  description?: string;
  workflowId: string;
  workflowName: string;
  createdBy: string;
  createdByName: string;
  currentStep: number;
  status: RequestStatus;
  history: RequestAction[];
  createdAt: string;
  updatedAt: string;
  stepApprovals: { [stepIndex: number]: string[] }; // NEW: Map of step -> approver IDs
  stepStartTimes: { [stepIndex: number]: string }; // NEW: Map of step -> start time
  escalated: boolean; // NEW
  originalRequiredRole?: Role; // NEW
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
