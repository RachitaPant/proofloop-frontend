import { Router, type Request } from 'express';
import { ApproverGroupInput } from '@proofloop/shared';
import { validateBody } from '../middleware/validate';
import { currentUser, requireAdmin, requireAuth } from '../middleware/auth';
import * as groupService from '../services/group.service';

export const groupRoutes = Router();
groupRoutes.use(requireAuth);

// Readable by everyone signed in (workflow builders pick groups); managed by admins.
groupRoutes.get('/', async (_req, res) => {
  res.json(await groupService.listGroups());
});

groupRoutes.post('/', requireAdmin, validateBody(ApproverGroupInput), async (req, res) => {
  res.status(201).json(await groupService.createGroup(currentUser(req), req.body));
});

groupRoutes.put('/:id', requireAdmin, validateBody(ApproverGroupInput), async (req: Request<{ id: string }>, res) => {
  res.json(await groupService.updateGroup(req.params.id, req.body));
});

groupRoutes.delete('/:id', requireAdmin, async (req: Request<{ id: string }>, res) => {
  await groupService.deleteGroup(req.params.id);
  res.status(204).send();
});
