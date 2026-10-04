const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const analyticsService = require('../services/analytics.service');
const requestService = require('../services/request.service');
const slaEscalationService = require('../services/slaEscalation.service');
const userService = require('../services/user.service');

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/analytics', async (_req, res, next) => {
  try {
    res.json(await analyticsService.getAnalytics());
  } catch (err) {
    next(err);
  }
});

router.get('/requests', async (_req, res, next) => {
  try {
    res.json(await requestService.getAllRequests());
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    res.json(await userService.listUsers());
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/users/:id/role',
  [body('role').isIn(['USER', 'REVIEWER', 'ADMIN']).withMessage('Role must be USER, REVIEWER or ADMIN')],
  validate,
  async (req, res, next) => {
    try {
      res.json(await userService.updateRole(req.user, req.params.id, req.body.role));
    } catch (err) {
      next(err);
    }
  },
);

router.post('/trigger-sla-check', async (_req, res, next) => {
  try {
    const escalatedCount = await slaEscalationService.checkAndEscalateRequests();
    res.json({ message: 'SLA escalation check triggered', escalatedCount });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
