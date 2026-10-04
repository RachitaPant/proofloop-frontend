import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Role } from '@proofloop/shared';

export interface IWorkflowStep {
  stepIndex: number;
  stepName: string;
  requiredRole: Role;
  requiredApprovals: number;
  slaHours?: number | null;
}

export interface IWorkflow {
  name: string;
  description?: string | null;
  createdBy: string;
  steps: IWorkflowStep[];
  createdAt: Date;
}

// Embedded, no own _id
const workflowStepSchema = new Schema<IWorkflowStep>(
  {
    stepIndex: { type: Number, required: true },
    stepName: { type: String, required: true },
    requiredRole: { type: String, enum: ['USER', 'REVIEWER', 'ADMIN'], required: true },
    requiredApprovals: { type: Number, default: 1 },
    slaHours: { type: Number, default: null },
  },
  { _id: false },
);

const workflowSchema = new Schema<IWorkflow>(
  {
    name: { type: String, required: true },
    description: { type: String },
    createdBy: { type: String, required: true },
    steps: { type: [workflowStepSchema], required: true },
  },
  {
    collection: 'workflows',
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type WorkflowDoc = HydratedDocument<IWorkflow>;
export const Workflow = model<IWorkflow>('Workflow', workflowSchema);
