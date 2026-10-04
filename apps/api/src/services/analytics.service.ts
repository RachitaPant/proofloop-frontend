import type { Analytics } from '@proofloop/shared';
import { Request } from '../models/Request';
import { Workflow } from '../models/Workflow';
import { User } from '../models/User';

export async function getAnalytics(): Promise<Analytics> {
  const [byStatus, totalWorkflows, totalUsers] = await Promise.all([
    Request.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Workflow.countDocuments(),
    User.countDocuments(),
  ]);

  const count = (status: string) => byStatus.find((s) => s._id === status)?.count ?? 0;
  return {
    totalRequests: byStatus.reduce((sum, s) => sum + s.count, 0),
    pendingRequests: count('PENDING'),
    inReviewRequests: count('IN_REVIEW'),
    approvedRequests: count('APPROVED'),
    rejectedRequests: count('REJECTED'),
    totalWorkflows,
    totalUsers,
  };
}
