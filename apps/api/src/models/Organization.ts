import { Schema, model, type HydratedDocument } from 'mongoose';

// A tenant. Every user, workflow, request, delegation and approver group
// belongs to exactly one organisation, and every query is scoped to it.
export interface IOrganization {
  name: string;
  /** The organisation that pre-org data was migrated into (exactly one). */
  isDefault?: boolean;
  createdBy?: string | null;
  createdAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  {
    collection: 'organizations',
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.isDefault;
        return ret;
      },
    },
  },
);

// At most one default organisation, even if two cold starts race to create it.
organizationSchema.index({ isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export type OrganizationDoc = HydratedDocument<IOrganization>;
export const Organization = model<IOrganization>('Organization', organizationSchema);
