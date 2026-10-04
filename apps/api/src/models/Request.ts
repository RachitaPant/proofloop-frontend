import { Schema, model, type HydratedDocument } from 'mongoose';
import type { ActionType, RequestStatus, Role } from '@proofloop/shared';

export interface IRequestAction {
  stepIndex: number;
  action: ActionType;
  actedBy: string;
  actedByName: string;
  comment?: string | null;
  timestamp: Date;
  previousHash?: string;
  currentHash?: string;
}

export interface IRequest {
  title: string;
  description?: string | null;
  workflowId: string;
  workflowName: string;
  createdBy: string;
  createdByName: string;
  currentStep: number;
  status: RequestStatus;
  history: IRequestAction[];
  createdAt: Date;
  updatedAt: Date;
  /** step index → ids of users who approved that step */
  stepApprovals: Map<string, string[]>;
  /** step index → when the step became current */
  stepStartTimes: Map<string, Date>;
  escalated: boolean;
  originalRequiredRole?: Role | null;
}

// Embedded, no own _id
const requestActionSchema = new Schema<IRequestAction>(
  {
    stepIndex: { type: Number, required: true },
    action: { type: String, enum: ['APPROVED', 'REJECTED'], required: true },
    actedBy: { type: String, required: true },
    actedByName: { type: String, required: true },
    comment: { type: String },
    timestamp: { type: Date, required: true },
    previousHash: { type: String },
    currentHash: { type: String },
  },
  { _id: false },
);

const requestSchema = new Schema<IRequest>(
  {
    title: { type: String, required: true },
    description: { type: String },
    workflowId: { type: String, required: true },
    workflowName: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
    currentStep: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'], required: true },
    history: { type: [requestActionSchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
    stepApprovals: { type: Map, of: [String], default: {} },
    stepStartTimes: { type: Map, of: Date, default: {} },
    escalated: { type: Boolean, default: false },
    originalRequiredRole: { type: String, enum: ['USER', 'REVIEWER', 'ADMIN'], default: null },
  },
  {
    collection: 'requests',
    // Every save() checks __v, so two concurrent approvals on the same request
    // can't both succeed: the loser gets a VersionError (mapped to 409).
    optimisticConcurrency: true,
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      flattenMaps: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

requestSchema.index({ status: 1 });
requestSchema.index({ createdBy: 1 });
requestSchema.index({ workflowId: 1, status: 1 });

export type RequestDoc = HydratedDocument<IRequest>;
export const Request = model<IRequest>('Request', requestSchema);
