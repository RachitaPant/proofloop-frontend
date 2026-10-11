import { Schema, model, type HydratedDocument } from 'mongoose';
import type { FieldType, Role, StepCondition } from '@proofloop/shared';

export interface IWorkflowField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[] | null;
}

export interface IWorkflowStep {
  stepIndex: number;
  stepName: string;
  requiredRole: Role;
  requiredApprovals: number;
  slaHours?: number | null;
  /** Absent on workflows created before stages existed: those run one step per stage. */
  stage?: number | null;
  condition?: StepCondition | null;
}

export interface IWorkflow {
  name: string;
  description?: string | null;
  createdBy: string;
  fields: IWorkflowField[];
  steps: IWorkflowStep[];
  createdAt: Date;
}

// Embedded, no own _id
const workflowFieldSchema = new Schema<IWorkflowField>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['number', 'text', 'select'], required: true },
    required: { type: Boolean, default: false },
    options: { type: [String], default: undefined },
  },
  { _id: false },
);

const workflowStepSchema = new Schema<IWorkflowStep>(
  {
    stepIndex: { type: Number, required: true },
    stepName: { type: String, required: true },
    requiredRole: { type: String, enum: ['USER', 'REVIEWER', 'ADMIN'], required: true },
    requiredApprovals: { type: Number, default: 1 },
    slaHours: { type: Number, default: null },
    stage: { type: Number },
    // Validated by the shared Zod schema before it gets here.
    condition: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const workflowSchema = new Schema<IWorkflow>(
  {
    name: { type: String, required: true },
    description: { type: String },
    createdBy: { type: String, required: true },
    fields: { type: [workflowFieldSchema], default: [] },
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
        // Older workflows: no fields, and stage = position.
        ret.fields ??= [];
        ret.steps = (ret.steps as IWorkflowStep[]).map((s, i) => ({ ...s, stage: s.stage ?? i }));
        return ret;
      },
    },
  },
);

export type WorkflowDoc = HydratedDocument<IWorkflow>;
export const Workflow = model<IWorkflow>('Workflow', workflowSchema);
