const Request = require('../models/Request');
const Workflow = require('../models/Workflow');
const User = require('../models/User');

async function getAnalytics() {
  const [totalRequests, pendingRequests, inReviewRequests, approvedRequests, rejectedRequests, totalWorkflows, totalUsers] =
    await Promise.all([
      Request.countDocuments(),
      Request.countDocuments({ status: 'PENDING' }),
      Request.countDocuments({ status: 'IN_REVIEW' }),
      Request.countDocuments({ status: 'APPROVED' }),
      Request.countDocuments({ status: 'REJECTED' }),
      Workflow.countDocuments(),
      User.countDocuments(),
    ]);

  return {
    totalRequests,
    pendingRequests,
    inReviewRequests,
    approvedRequests,
    rejectedRequests,
    totalWorkflows,
    totalUsers,
  };
}

module.exports = { getAnalytics };
