import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Workflow } from '../models/Workflow';
import { Request } from '../models/Request';

// Demo data for local development. Never runs when NODE_ENV=production.
export async function seedData() {
  if (process.env.NODE_ENV === 'production') return;

  if ((await User.countDocuments()) > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database with demo data...');

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@proofloop.com',
    passwordHash: await bcrypt.hash('admin123', 10),
    role: 'ADMIN',
  });

  await User.create({
    name: 'Reviewer User',
    email: 'reviewer@proofloop.com',
    passwordHash: await bcrypt.hash('reviewer123', 10),
    role: 'REVIEWER',
  });

  const user = await User.create({
    name: 'Regular User',
    email: 'user@proofloop.com',
    passwordHash: await bcrypt.hash('user123', 10),
    role: 'USER',
  });

  const projectApproval = await Workflow.create({
    name: 'Project Approval',
    description: 'Multi-stage project approval workflow',
    createdBy: admin.id,
    steps: [
      { stepIndex: 0, stepName: 'Initial Review', requiredRole: 'REVIEWER' },
      { stepIndex: 1, stepName: 'Final Approval', requiredRole: 'ADMIN' },
    ],
  });

  const documentApproval = await Workflow.create({
    name: 'Document Approval',
    description: 'Simple document approval workflow',
    createdBy: admin.id,
    steps: [{ stepIndex: 0, stepName: 'Manager Review', requiredRole: 'REVIEWER' }],
  });

  const now = new Date();
  await Request.create({
    title: 'New Feature Proposal',
    description: 'Proposal to add user authentication to the system',
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
  console.log('Demo credentials:');
  console.log('Admin: admin@proofloop.com / admin123');
  console.log('Reviewer: reviewer@proofloop.com / reviewer123');
  console.log('User: user@proofloop.com / user123');
}
