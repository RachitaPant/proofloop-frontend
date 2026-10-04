const { Schema, model } = require('mongoose');

// Mirrors com.proofloop.entity.RequestAction (embedded, no own _id)
const requestActionSchema = new Schema(
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

// Mirrors com.proofloop.entity.Request / collection "requests"
const requestSchema = new Schema(
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
    // can't both succeed — the loser gets a VersionError (mapped to 409).
    optimisticConcurrency: true,
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      flattenMaps: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  },
);

requestSchema.index({ status: 1 });
requestSchema.index({ createdBy: 1 });
requestSchema.index({ workflowId: 1, status: 1 });

module.exports = model('Request', requestSchema);
