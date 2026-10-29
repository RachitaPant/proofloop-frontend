import { Schema, model, type HydratedDocument } from 'mongoose';

// A named set of users (e.g. "Finance team") that a workflow step can be
// assigned to instead of a role. Membership is read at action time, so adding
// or removing someone takes effect on in-flight requests immediately.
export interface IApproverGroup {
  name: string;
  description?: string | null;
  memberIds: string[];
  createdBy: string;
  orgId: string;
  createdAt: Date;
}

const approverGroupSchema = new Schema<IApproverGroup>(
  {
    name: { type: String, required: true },
    description: { type: String },
    memberIds: { type: [String], default: [] },
    createdBy: { type: String, required: true },
    orgId: { type: String, index: true },
  },
  {
    collection: 'approver_groups',
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

approverGroupSchema.index({ orgId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export type ApproverGroupDoc = HydratedDocument<IApproverGroup>;
export const ApproverGroup = model<IApproverGroup>('ApproverGroup', approverGroupSchema);
