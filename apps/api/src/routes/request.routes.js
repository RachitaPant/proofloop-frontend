const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const requestService = require('../services/request.service');

const router = Router();
router.use(requireAuth);

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title is too long'),
    body('description').optional({ nullable: true }).isString().isLength({ max: 5000 }).withMessage('Description is too long'),
    body('workflowId').notEmpty().withMessage('Workflow ID is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      res.json(await requestService.createRequest(req.user, req.body));
    } catch (err) {
      next(err);
    }
  },
);

router.get('/mine', async (req, res, next) => {
  try {
    res.json(await requestService.getMyRequests(req.user));
  } catch (err) {
    next(err);
  }
});

router.get('/pending', async (req, res, next) => {
  try {
    res.json(await requestService.getPendingRequests(req.user));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await requestService.getRequestById(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/:id/verify', async (req, res, next) => {
  try {
    res.json(await requestService.verifyRequestChain(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

const commentRules = [
  body('comment').optional({ nullable: true }).isString().isLength({ max: 2000 }).withMessage('Comment must be text under 2000 characters'),
];

router.post('/:id/approve', commentRules, validate, async (req, res, next) => {
  try {
    res.json(await requestService.approveRequest(req.user, req.params.id, req.body?.comment));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reject', commentRules, validate, async (req, res, next) => {
  try {
    res.json(await requestService.rejectRequest(req.user, req.params.id, req.body?.comment));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
