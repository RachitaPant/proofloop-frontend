const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const workflowService = require('../services/workflow.service');

const router = Router();
router.use(requireAuth);

router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Workflow name is required'),
    body('steps').isArray({ min: 1 }).withMessage('Workflow must have at least one step'),
    body('steps.*.stepIndex').notEmpty().withMessage('Step index is required'),
    body('steps.*.stepName').notEmpty().withMessage('Step name is required'),
    body('steps.*.requiredRole').isIn(['USER', 'REVIEWER', 'ADMIN']).withMessage('Required role is required'),
    body('steps.*.requiredApprovals').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Required approvals must be at least 1'),
    body('steps.*.slaHours').optional({ nullable: true }).isInt({ min: 1 }).withMessage('SLA hours must be at least 1 if specified'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const workflow = await workflowService.createWorkflow(req.user, req.body);
      res.json(workflow);
    } catch (err) {
      next(err);
    }
  },
);

router.get('/', async (_req, res, next) => {
  try {
    res.json(await workflowService.getAllWorkflows());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await workflowService.getWorkflowById(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await workflowService.deleteWorkflow(req.user, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
