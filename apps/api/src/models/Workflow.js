const { Schema, model } = require('mongoose');

// Mirrors com.proofloop.entity.WorkflowStep (embedded, no own _id)
const workflowStepSchema = new Schema(
  {
    stepIndex: { type: Number, required: true },
    stepName: { type: String, required: true },
    requiredRole: { type: String, enum: ['USER', 'REVIEWER', 'ADMIN'], required: true },
    requiredApprovals: { type: Number, default: 1 },
    slaHours: { type: Number, default: null },
  },
  { _id: false },
);

// Mirrors com.proofloop.entity.Workflow / collection "workflows"
const workflowSchema = new Schema(
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
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  },
);

module.exports = model('Workflow', workflowSchema);
