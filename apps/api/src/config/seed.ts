import bcrypt from 'bcryptjs';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
import { Workflow } from '../models/Workflow';
import { Request } from '../models/Request';
import { ApproverGroup } from '../models/ApproverGroup';

// Sample organisation for local development only; never runs when
// NODE_ENV=production. Real organisations are created through sign-up.
export async function seedData() {
  if (process.env.NODE_ENV === 'production') return;

  if ((await User.countDocuments()) > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database with a sample organisation...');

  const org = await Organization.create({ name: 'Acme (sample)' });
  const orgId = org.id as string;

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@proofloop.com',
    passwordHash: await bcrypt.hash('admin123', 10),
    role: 'ADMIN',
    isOwner: true,
    orgId,
  });
  org.createdBy = admin.id;
  await org.save();

  const reviewer = await User.create({
    name: 'Reviewer User',
    email: 'reviewer@proofloop.com',
    passwordHash: await bcrypt.hash('reviewer123', 10),
    role: 'REVIEWER',
    orgId,
  });

  const user = await User.create({
    name: 'Regular User',
    email: 'user@proofloop.com',
    passwordHash: await bcrypt.hash('user123', 10),
    role: 'USER',
    orgId,
  });

  const projectApproval = await Workflow.create({
    name: 'Project Approval',
    description: 'Multi-stage project approval workflow',
    createdBy: admin.id,
    orgId,
    steps: [
      { stepIndex: 0, stepName: 'Initial Review', requiredRole: 'REVIEWER' },
      { stepIndex: 1, stepName: 'Final Approval', requiredRole: 'ADMIN' },
    ],
  });

  const documentApproval = await Workflow.create({
    name: 'Document Approval',
    description: 'Simple document approval workflow',
    createdBy: admin.id,
    orgId,
    steps: [{ stepIndex: 0, stepName: 'Manager Review', requiredRole: 'REVIEWER' }],
  });

  // Shows off approver groups: Legal review goes to this team, not a role.
  const legalTeam = await ApproverGroup.create({
    name: 'Legal team',
    description: 'Contract and compliance reviewers',
    memberIds: [reviewer.id],
    createdBy: admin.id,
    orgId,
  });

  // Shows off conditional routing, a parallel stage and a group-assigned step.
  await Workflow.create({
    name: 'Purchase Approval',
    description: 'Manager sign-off, then legal and security in parallel; the CFO only for large amounts.',
    createdBy: admin.id,
    orgId,
    fields: [
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'department', label: 'Department', type: 'select', required: true, options: ['Engineering', 'Finance', 'Sales'] },
    ],
    steps: [
      { stepIndex: 0, stepName: 'Manager review', requiredRole: 'REVIEWER', stage: 0, slaHours: 24 },
      { stepIndex: 1, stepName: 'Legal review', approverGroupId: legalTeam.id, approverGroupName: legalTeam.name, stage: 1 },
      { stepIndex: 2, stepName: 'Security review', requiredRole: 'REVIEWER', stage: 1 },
      {
        stepIndex: 3,
        stepName: 'CFO approval',
        requiredRole: 'ADMIN',
        stage: 2,
        condition: { mode: 'all', rules: [{ field: 'amount', operator: 'gt', value: 100000 }] },
      },
    ],
  });

  const now = new Date();
  await Request.create({
    title: 'New Feature Proposal',
    description: 'Proposal to add user authentication to the system',
    orgId,
    workflowId: projectApproval.id,
    workflowName: projectApproval.name,
    createdBy: user.id,
    createdByName: user.name,
    currentStep: 0,
    status: 'PENDING',
    history: [],
    stepStartTimes: { 0: now },
    updatedAt: now,
  });

  await Request.create({
    title: 'Budget Request Q1 2025',
    description: 'Request for additional budget allocation',
    orgId,
    workflowId: documentApproval.id,
    workflowName: documentApproval.name,
    createdBy: user.id,
    createdByName: user.name,
    currentStep: 0,
    status: 'IN_REVIEW',
    history: [],
    stepStartTimes: { 0: now },
    updatedAt: now,
  });

  console.log('Database seeded successfully!');
  console.log('Local sample accounts:');
  console.log('Admin: admin@proofloop.com / admin123');
  console.log('Reviewer: reviewer@proofloop.com / reviewer123');
  console.log('User: user@proofloop.com / user123');
}
